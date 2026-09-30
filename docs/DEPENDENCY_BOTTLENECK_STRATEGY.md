# Strategy: Negating the Feature Dependency Bottleneck

**Status:** Proposal — for developer review
**Owner:** unassigned
**Related:** [`DEPENDENCY_BOTTLENECK_BACKLOG.md`](DEPENDENCY_BOTTLENECK_BACKLOG.md) (the original project-specific write-up this generalizes from), `features/index.json`, `rules/workflow.md`

This document is written for anyone designing or maintaining an AI-agent development pipeline — not just this project. It answers one question: **can the feature-dependency bottleneck be removed, and if so, how?**

It was produced by asking four independent research agents to look at the problem from four different angles without seeing each other's answers (to avoid one train of thought wearing four hats), then synthesizing their findings. Every agent's reasoning is included in full below — nothing was trimmed out.

---

## 1. The Problem, in Plain Terms

In a staged AI-agent pipeline, a feature is usually planned, then its API is designed and "frozen," then it's built, tested, and merged. A second feature that depends on the first one is normally not allowed to even _start planning_ until the first feature has gone all the way through that entire process.

But most of the time, the second feature doesn't need the first feature's finished, running code — it only needs to know the **shape** of the first feature's API (what endpoints exist, what fields they take, what they return). That shape is usually decided very early, at the "freeze" step, long before the feature is actually built and merged.

Because the pipeline doesn't distinguish "I need your API shape" from "I need your actual running code," it applies the stricter rule (wait for everything) even in cases where the looser rule (wait for the shape) would be enough. If six features all depend on one foundational feature (like authentication), this turns what could be six parallel workstreams into roughly one active workstream at a time.

**The question this document answers:** can this be fixed completely, and if not, how far can it realistically be pushed?

---

## 2. The Honest Ceiling: It Cannot Be Fully Eliminated

Before listing solutions, it's important to be upfront about the limit, because every solution below has one.

"Feature B depends on Feature A" is actually three different kinds of dependency bundled into one word:

| Kind of dependency            | What it means                                                                                                                              | Can an early "freeze" fix it?                                                                                                                                                                                                                                                                 |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shape**                     | Function signatures, request/response fields, data types                                                                                   | **Yes** — this is exactly what freezing an API contract early resolves.                                                                                                                                                                                                                       |
| **Behavior**                  | What the feature actually _does_ in edge cases: error handling, retry behavior, ordering guarantees, idempotency                           | **No** — a frozen contract is a _claim_ about behavior, written by a person who is often wrong about edge cases precisely when the feature is genuinely new or complex.                                                                                                                       |
| **Non-functional properties** | Real-world latency, rate limits, behavior under concurrent load, actual security properties (e.g., whether a token can really be replayed) | **No** — these are properties of a _running system_. They cannot be measured, tested, or verified before that system exists, no matter how good your tools or process are. This isn't a process gap — it's a logical impossibility to observe a property of something that doesn't exist yet. |

**Verdict from the research:** roughly **60–70% of the delay is a process artifact** — unnecessary full-serialization when only the shape was actually needed — and is genuinely, non-illusorily fixable. The remaining **30–40% is inherent**: any dependency with real behavioral novelty, safety/security criticality, or performance sensitivity will still produce some rework once the real thing is built, no matter how well you plan around it.

**The honest goal, then, is not "eliminate the bottleneck."** It's: **convert a hard, blocking, full-lifecycle dependency into a soft, early-unblocking dependency, with a small, well-contained cost paid later if reality turns out different from what was assumed.**

Keep this table in mind — every mechanism below is judged against it.

---

## 3. Four Independent Perspectives

### 3.1 Distributed-Systems / Software-Architecture Lens

_How real engineering organizations solve this exact class of problem, independent of AI._

Ranked from strongest to weakest:

1. **Consumer-driven contract testing (Pact-style).** The downstream feature (B) writes automated tests describing what it expects from the upstream feature's (A's) API. These are published somewhere both sides can see (a "broker"). A's real implementation must pass B's tests before it's allowed to merge. This converts "B needs A's code" into "B needs A's contract to stay green" — B can build and even ship against a fake version of A indefinitely.
   - _Cost:_ if A's team changes something without re-running B's tests, or the broker isn't enforced as a hard gate on both sides, the mismatch is caught late — as an integration failure. It also doesn't catch non-functional mismatches like real latency or rate limits.
2. **Walking skeleton / mock server, promoted with a feature flag.** Instead of a document describing A's API, stand up a real, thin, deployable version of it on day one — real network calls, but fake business logic inside. Every downstream feature builds against this live-but-hollow version. This catches more than a written contract does (deployment quirks, auth headers, timeouts) because it's actually running.
   - _Cost:_ someone has to build and maintain this stub, and if its fake behavior (e.g. "always returns 3 items") isn't part of the real contract, downstream features may accidentally depend on behavior that was never promised.
3. **Schema registry with enforced compatibility rules.** A's data shapes are registered and version-controlled; automated tooling refuses any change that isn't backward-compatible (e.g., you can't silently remove a required field). B pins to a schema version instead of to A's actual codebase.
   - _Cost:_ this only prevents _accidental_ breaking changes. If A's real implementation discovers it needs an entirely new concept (e.g., "actually we need multi-factor auth"), that's a genuine, unavoidable interface change no compatibility checker can prevent.
4. **Anti-corruption layer / adapter seam.** B never talks to A directly — it talks to its own small adapter interface, which is backed by a fake implementation first and a real one later. This is a standard, cheap pattern that limits how much of B's code is affected if A changes, but it doesn't make B start any earlier — it's damage control, not parallelization.
5. **Trunk-based development with expand/contract migrations.** Both sides commit small changes continuously (behind feature flags), and A's real rollout happens in stages — add the new thing alongside the old, migrate consumers, then remove the old thing — instead of one big risky cutover. This mostly smooths the _pain of the eventual merge_, rather than reducing the _wait_ before that merge.

**This lens's bottom line:** mechanisms 1 and 2 together (contract tests as the enforcement gate, a runnable stub as the thing people actually build against) get closest to genuinely removing the wait. Mechanisms 3–5 reduce risk and pain but all assume the upstream's shape is basically right — which is exactly the assumption that breaks when the upstream (like auth) is still discovering its own requirements.

---

### 3.2 Multi-Agent AI Orchestration Lens

_How this problem should be solved specifically when the workers are AI agents, not human teams — because agents can do things humans can't (like temporarily pretend to be the missing dependency)._

Ranked from strongest to weakest:

1. **Make "contract frozen" its own trigger event, separate from "merged."** Today, the pipeline typically has one signal: "feature A is done." Instead, it should emit two distinct signals — "A's interface is frozen" (much earlier) and "A's real implementation is merged" (much later). Downstream planning and build agents should react to the _first_ signal; only the final integration step should wait for the _second_. This is the actual root fix — everything else either builds on top of it or compensates for not having it.
   - _Cost:_ this only works if "frozen" really means frozen. If the upstream team keeps quietly changing the contract after "freezing" it, you've just moved the problem into a pile of reconciliation work.
2. **A simulated-upstream agent.** Spin up a separate, lightweight AI agent whose only job is to _role-play_ feature A according to its frozen contract — answering requests with plausible fake data and behavior. This gives downstream agents something they can actually run their code and tests against, not just a written type signature — a meaningfully bigger win than a document, because it unblocks _testing_, not just planning.
   - _Cost:_ the role-playing agent will inevitably guess wrong about tricky edge cases (error codes, pagination, race conditions) because it's optimizing for "plausible," not "matches what gets built later." When that guess is wrong, it's discovered late, during integration, and can be hard to trace back to which assumption broke.
3. **Speculative execution with "contract hash" pinning and automatic, scoped re-planning.** Downstream agents build against a specific, fingerprinted version of the contract. Once the real upstream feature merges, an automated process compares the real API against that fingerprint. If something changed, it automatically creates a small, targeted fix-it task covering _only_ the part that changed — not a full restart of the downstream feature.
   - _Cost:_ the amount of rework scales with how much actually changed between freeze and merge. If "frozen" is treated loosely, this degrades back into full restarts.
4. **A shared "blackboard" with confidence-scored, provisional work.** A's contract is posted as a trusted, "final" artifact. Everything built by downstream agents on top of it is tagged as "provisional" until A's real implementation is verified against it. This lets many features fan out from one shared dependency with explicit bookkeeping about what's still uncertain.
   - _Cost:_ if C depends on B which depends on A, and both B and C are "provisional," it becomes harder to trace exactly where an eventual mismatch actually came from.
5. **Agent-to-agent negotiation before breaking changes.** Before the upstream feature's real implementation merges a change that would break the frozen contract, it must first notify and get acknowledgment from every downstream feature that depends on it — turning "downstream discovers the break after the fact" into "downstream is warned before it happens."
   - _Cost:_ this reduces wasted work but doesn't get anyone started earlier — it only helps after work has already begun.

**This lens's bottom line:** #1 is the structural fix; #2 and #3 are what make #1 actually usable in practice (agents get something runnable to build and test against, with a cheap, bounded way to fix things when reality diverges); #4 and #5 are useful hygiene on top, not bottleneck removers by themselves.

---

### 3.3 Organizational / Process-Design Lens

_How real engineering organizations (not just individual teams) structure themselves to avoid this — drawing on things like Team Topologies, Agile Release Trains, and platform-team patterns._

Ranked from strongest to weakest:

1. **Turn the foundational dependency into an owned, versioned platform product — not a feature waiting in the same queue as everything else.** Something like "auth," which almost everything depends on, should not be treated as just another feature competing for a spot in the schedule. It should be owned by its own dedicated team (or, in an AI-agent context, have its own standing planning process) with a real version number, a published deprecation policy, and its own release rhythm. Downstream features consume a specific numbered version of it, never "whatever state someone's current sprint happens to be in." This is the only fix that's permanent — it doesn't just unblock this one case, every _future_ foundational dependency inherits the same benefit.
   - _Cost:_ real organizational redesign, a permanent commitment of people/attention to maintain it, and the risk that this team itself becomes a bottleneck if it isn't staffed or scoped properly.
2. **Redefine what "freezing a contract" produces — make it a runnable stub, not a document.** Same idea as the walking-skeleton pattern above, described here as a _process change_: the exit requirement of the design/freeze step should explicitly be "a working mock exists," not "a document was approved." This nearly removes the wait for the pipeline described here, because it unblocks _building_, not just planning.
   - _Cost:_ if the stub silently drifts from the real implementation later without anyone renegotiating, you get the same late-discovered mismatch problem as everywhere else.
3. **A named "contract steward" role plus a mandatory pre-planning workshop.** One accountable person (or small group) negotiates the interface with _every_ downstream consumer _before_ the upstream feature's own team-level planning even starts — one synchronized meeting instead of many one-on-one renegotiations later.
   - _Cost:_ if too many features compete for this person's time, they become a bottleneck themselves — just with one person's calendar instead of one feature's whole lifecycle. This needs a hard turnaround-time limit to stay useful.
4. **An "inner-source" style RFC process with a fixed comment window.** Treat the upstream API like an internally open-sourced library: publish a short design proposal, open a fixed, short window (e.g. two days) for every consuming team to comment, then freeze. This is a lighter version of the steward role — no permanent role required, just a repeatable norm.
   - _Cost:_ without one accountable owner, comments might not converge, and the freeze date can slip.
5. **A shared "dependency planning" event, done at a program level.** All teams that touch a shared dependency plan together in one synchronized session, with dependencies made visible on a shared board, and downstream teams pre-committing to start the moment a dependency's status flips to "frozen" (not "shipped").
   - _Cost:_ this kind of ceremony is usually run quarterly in human organizations, which is far slower than an AI-agent pipeline's actual iteration speed. It would need to be compressed into a much faster rhythm to avoid becoming the new bottleneck.
6. **Make "contract frozen + tests published" the literal, written gate condition in the pipeline's own rules** — instead of "feature merged." This is the cheapest option: it's a policy/documentation change, not an organizational one, so it doesn't touch team structure. But it's also the weakest on its own — it only helps if one of mechanisms 1–4 already exists to give people something concrete to build against once that gate opens.

**This lens's bottom line:** 1 and 2 are structural, near-permanent fixes; 3 and 4 are people/ceremony fixes that meaningfully help but leave some residual waiting; 5 and 6 are the cheapest to add to an existing pipeline, but weakest on their own.

---

### 3.4 The Skeptic's Rebuttal (Red Team)

_Deliberately arguing against the idea that this can be "completely negated," to stress-test the other three lenses._

**The irreducible core.** As covered in Section 2, shape can be fixed by an early freeze; behavior and non-functional properties cannot, because they are properties of a system that doesn't exist yet. This part of the problem doesn't shrink as your tools and process improve — it just gets pushed later, where it shows up as an integration-time surprise no matter how clean everything looked beforehand.

**Every proposed fix relocates the problem instead of removing it:**

- **Early contract freeze** moves the single point of failure to _"did we freeze the right thing?"_ A wrong early guess is now _more_ expensive than a late one would have been, because more downstream work has already been built on top of the wrong assumption — the freeze needs _more_ foresight than the old, fully-serial process did, not less.
- **Consumer-driven contract testing** moves the bottleneck to _aggregating_ every consumer's expectations into one implementable contract before the upstream is even built — which is the same kind of coordination problem as before, just relabeled.
- **Turning a dependency into a versioned platform** moves the bottleneck into deprecation and migration debt — now there are old-version consumers and new-version consumers drifting apart, and someone pays that cost later, usually with less context than they had at freeze time.
- **Speculative/simulated execution** moves the bottleneck into _reconciliation cost_, which scales with how wrong the simulation turns out to be — for a genuinely novel or complex upstream feature, fixing up the guesswork afterward can cost more than just waiting would have.
- **A contract steward or cross-cutting review role** moves the bottleneck into that person or process becoming the new queue — a single gatekeeper reviewing everyone's needs recreates exactly the serialization the pipeline was trying to escape, just with one role instead of one feature.

**Final verdict:** roughly 60–70% of the delay is genuinely fixable (this matches the estimate in Section 2) — early shape-freezing plus building in parallel against a mock is a real win, especially for simple, low-novelty dependencies (most CRUD-style features, like a typical auth or profile feature, qualify). The remaining 30–40% is inherent: any dependency with real behavioral complexity, safety/security stakes, or performance sensitivity will generate rework once the real thing exists, and no amount of upfront simulation avoids that, because that rework requires the real artifact to exist first. **The honest way to describe this is "deferring the risk cheaply," not "eliminating the bottleneck."**

---

## 4. Where All Four Agents Agreed (The Strongest Signal)

None of the four agents saw each other's answers, which makes their overlap meaningful rather than coincidental:

1. **Split "needs your API shape" from "needs your real running code," and gate downstream work on the first one, not the second.** Every single lens proposed a version of this — it's the strongest, most-repeated idea across all four independent investigations.
2. **The output of "freezing" a contract should be something runnable (a mock server, stub, or simulated agent) — not just a written document.** A document can be misread or misimplemented; something runnable can actually be built and tested against, catching mistakes immediately instead of much later.
3. **Accept that reality will sometimes diverge from the early guess, and build a small, targeted repair process for when it does** — rather than pretending it won't happen, and rather than reacting to it with a full restart.
4. **Avoid routing all of this through a single reviewing person or role.** Both the skeptic and the orchestration lens independently warned that a single steward/gatekeeper checking everyone's needs before a freeze just re-creates the original queue with fewer people in it.

---

## 5. Recommendation, in Priority Order

1. **Redefine the dependency edge itself.** Stop treating "B depends on A" as one thing. Track two kinds of dependency separately: a _shape_ dependency (resolved once A's contract is frozen) and a _runtime_ dependency (resolved once A's real code is merged). Downstream planning and building unlock on the first event; only true integration work waits on the second.
2. **Make the freeze produce something runnable.** Instead of ending the design step with just an approved document, end it with a working mock server (or, in an AI-agent context, an agent that role-plays the upstream feature) that implements the frozen shape. Downstream work builds and tests against this, not against prose.
3. **Build a small, targeted repair mechanism for when the mock and reality disagree.** Fingerprint the frozen contract version each downstream feature builds against. When the real implementation lands, automatically compare it to that fingerprint, and if something changed, create a small, scoped fix-it task covering only the affected piece — not a full restart of every feature that depended on it.
4. **For genuinely foundational dependencies (something many other features depend on, like auth), stop treating them as a regular feature in the queue at all.** Give it its own version number, its own release rhythm, and its own deprecation policy, so downstream features are pinning a stable version rather than waiting for a turn in line. This is the one fix that also prevents the _next_ foundational bottleneck, not just the current one.
5. **Make changes to a frozen contract proactive, not reactive.** Before the upstream feature's real implementation is allowed to merge a change that breaks something already frozen, it should have to notify and get acknowledgment from whoever built against that version — catching the problem before it ships, not after.

## 6. What to Actively Avoid

Do not solve this by adding a single steward, reviewer, or cross-cutting validation role that every consumer's needs must pass through before a contract can freeze. Two independent lenses (the skeptic and the orchestration agent) flagged this as the most common overcorrection: it feels like a fix, but it just moves the exact same queue onto one person or process instead of removing it. Prefer automated, tooling-based mechanisms — event triggers, automatic compatibility checks, fingerprinted contract diffing — over a review gate staffed by one entity.

## 7. The One Sentence Version

You cannot fully eliminate the wait caused by feature dependencies, because some of what "depends on" means can only be verified once the real thing exists — but you can remove most of it by freezing and publishing a _runnable_ version of the interface early, letting everyone build against that in parallel, and paying only a small, targeted cost later if reality turns out different from what was assumed.
