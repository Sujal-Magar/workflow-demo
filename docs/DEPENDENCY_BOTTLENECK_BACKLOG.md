# Backlog: Feature Dependency Bottleneck

**Status:** Proposal — for developer review
**Owner:** unassigned
**Related:** `features/index.json`, `rules/workflow.md`, `rules/architecture.md`, `packages/contracts`

---

## Problem (High Level)

`features/index.json` models cross-feature dependencies as a single chain:

```
auth ← profile ← transactions ← {budget, goals} ← reports ← dashboard
```

`dashboard` transitively depends on all six other features. In practice, a downstream feature is not allowed to start its own plan/build until the upstream feature it depends on has fully shipped — not just designed. Because the pipeline treats every dependency edge the same way, work that could run in parallel is instead forced into a nearly serial queue, one developer at a time.

### Concrete example

Current state (per `features/index.json` and `CLAUDE.md`):

- `auth` — plan v1.0.0 reviewed and **approved**, contract frozen, build not started yet.
- `profile` (`dependencies: ["auth"]`) — status: **awaiting-plan**.
- `transactions` (`dependencies: ["auth", "profile"]`) — status: **awaiting-plan**.
- `budget`, `goals`, `reports`, `dashboard` — further downstream, all **awaiting-plan**.

The `profile` developer wants to start Phase 1 (Plan Fragments) today. All they actually need is `auth`'s API shape — the user/session model `profile` will reference — which already exists: `auth`'s `v1.0.0/contract.md` was frozen at the Developer Approval Gate (Phase 4). But because `index.json` only records "`profile` depends on `auth`" with no distinction of *what kind* of dependency that is, the working assumption is that `profile` waits until `auth` clears Build (Phase 5), Integration (Phase 7), both Validation gates (7b/8c), and Test Build (Phase 8) — i.e. until `auth`'s code is merged — before `profile` is allowed to even begin planning.

Multiply this down the chain (`transactions` waits on `profile` *and* `auth`, `reports` waits on four features, `dashboard` waits on six) and the seven-feature backlog collapses into roughly one developer actively working at a time, regardless of how many people are available.

---

## Root Cause (Technical)

1. **One dependency edge, two different meanings.** A downstream feature can need an upstream feature for two very different reasons:
   - **Contract dependency** — it needs to know the upstream's API *shape* (routes, request/response types, error codes) to write its own FDS, plan, and contract. Per `rules/architecture.md`, this is fully captured by the shared ts-rest contract in `packages/contracts`, and per `rules/workflow.md`, that contract is **frozen at Phase 4** — well before the feature finishes building or merging.
   - **Runtime dependency** — it needs the upstream's *real, running code* (e.g. a `transactions` service calling `auth`'s session-validation logic). This genuinely can't be satisfied until Phase 7 (Integration Build), where real code from multiple features gets wired together.

   `index.json`'s `dependencies` array collapses both into one edge, so the strictest interpretation (runtime) is applied everywhere, even where only a contract dependency (resolved much earlier) actually exists.

2. **Status is read as a hard gate.** `awaiting-plan` in the Active Features table is being treated as "don't start" rather than "not yet started," so nothing signals that `profile` could begin the moment `auth`'s contract passes Phase 4.

3. **Existing workflow already assumes decoupling, just doesn't extend it.** `rules/workflow.md` has Frontend Build run entirely against mock data shaped to the frozen contract, with no live backend dependency — proving the pipeline already tolerates working against a contract instead of real code. That same idea isn't applied to feature-to-feature (especially backend-to-backend) dependencies.

---

## Suggestions

1. **Split the dependency type in `index.json`.** Add a `dependency_type` per entry: `contract` (needs only the upstream's frozen `contract.md`) vs `runtime` (needs the upstream's merged code). Most of the current fan-out (e.g. `profile`, `transactions`, `budget` all needing `auth`'s user/session shape) is `contract`-type, not `runtime`-type.

2. **Change the gating rule.** A feature can enter Phase 0–6 (spec through pre-integration build) once every `contract`-type dependency has passed Phase 4. Only Phase 7 (Integration Build) onward should require the upstream to actually be merged to trunk.

3. **Dependency inversion for genuine runtime coupling.** Where backend code truly needs another feature's service (e.g. "get current user" from `auth`), define it as an interface in the downstream service layer with a stub that satisfies the frozen contract; swap in the real implementation at Integration Build. Fits cleanly inside the existing Presentation → Service → Repository layering in `rules/architecture.md`.

4. **Contract-driven proxy/mock server.** Generate a mock server directly from each feature's frozen `contract.md` (ts-rest supports serving a contract with canned responses). Downstream frontend/backend point at that proxy's URL during Phase 0–6, then swap the base URL to the real merged service once Integration Build starts — no downstream code changes required. Risk: contract-mismatch bugs surface later, at Integration Build — but that's already a named failure category (`Contract mismatch`) routed through Diagnosis Mode in `rules/workflow.md`, so it doesn't require new process, just uses the existing one earlier in more cases.

5. **Extract cross-cutting concerns early.** `auth` is depended on by 6 of 7 features. Treat it as a small, stable foundation module released and versioned independently — with a minimum-version pin per the `dependencies` field already supported in FDS frontmatter — rather than a regular feature sitting in the same sequential queue as everything else.

6. **No-cost immediate unblock.** `auth`'s plan v1.0.0 is already approved and its contract is already frozen. Nothing in the documented rules actually prevents `profile`'s Phase 1 Plan Fragments from starting now against `auth`'s frozen `contract.md` — the current serialization looks like an operational habit, not a rule-enforced constraint.

---

## Tradeoffs / Risks

- Deferring contract-mismatch risk to Integration Build relies on the frozen-contract discipline already required during Build Mode (`rules/workflow.md`: "Neither side may modify `v<version>/contract.md`") — if that discipline slips, mismatches multiply instead of shrinking.
- The proxy/mock-server option (Suggestion 4) adds a small piece of shared infrastructure (e.g. a `packages/contract-mocks` package) that needs to be generated and kept in sync with each frozen contract.
- Splitting `dependency_type` (Suggestion 1) requires a one-time audit of the current `index.json` edges to classify each as `contract` or `runtime`.

---

## Next Steps

- [ ] Developer review of this note.
- [ ] If approved: add `dependency_type` to the `index.json` schema and reclassify existing edges.
- [ ] Update the Phase gating language in `rules/workflow.md` to unblock Phase 0–6 on contract freeze rather than full merge.
- [ ] Decide whether to pilot the contract-driven proxy/mock server (Suggestion 4) on the `profile` → `auth` edge first, since `auth`'s contract is already frozen.
