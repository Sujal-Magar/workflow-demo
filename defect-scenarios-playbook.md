# Defect Scenarios Playbook

**Status:** Live companion to `WORKFLOW_PLAYBOOK.md` — read this after Phase 8b (Diagnosis Mode) produces `v<version>/diagnosis.md`, when you need to know exactly what to do next for each kind of finding in it.

`v<version>/diagnosis.md` already includes a **Suggested Next Step** for every finding and for every batched group — a filled-in, ready-to-run instruction, not just a category label. For most defects, that's all you need: read the report, run what it says. This document is what to read when you want the fuller picture — why that's the right next step, what NOT to do, and how to handle cases the report flags as needing a human judgment call (Contract mismatch, FDS ambiguity, multiple findings interacting). Think of the diagnosis report as the specific instruction and this playbook as the manual behind it.

This is a developer-facing runbook, not a design document. For _why_ the workflow is built this way, see `docs/MULTI_AGENT_VS_SUB_AGENT.md`.

`[[FEATURE]]` = the feature ID (e.g. `expense-crud`); `[[VERSION]]` = the plan version. All plan artifacts named here live in `features/[[FEATURE]]/plans/v[[VERSION]]/` (fixed filenames: `plan.md`, `contract.md`, `review.md`, `directives.md`, `defects-unit-api.md`, `defects-ui-e2e.md`, `diagnosis.md`), except the shared `plans/activity-log.md`. The routing below follows the Rollback Decision Tree (`rules/workflow.md` §3) and the change classification (§4).

---

## Quick Reference

| Diagnosis says...             | It means...                                                                                          | You do...                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Backend defect**            | The implementation in `backend/` doesn't satisfy `v[[VERSION]]/contract.md` / the FDS                | Run `build-mode.md` with `Phase = Backend`, `Mode = Fix`                                     |
| **Frontend defect**           | The implementation in `frontend/` doesn't satisfy `v[[VERSION]]/contract.md` / the FDS/behavior spec | Run `build-mode.md` with `Phase = Frontend`, `Mode = Fix`                                    |
| **Integration-wiring defect** | Both sides are individually correct against the contract, but wired together wrong                   | Re-run `build-mode.md`, `Phase = Integration`, scoped to the specific defect                 |
| **Bad test**                  | The test itself is wrong; production code is fine                                                    | Re-run `test-build-mode.md` with `Phase = UnitAPI` or `Phase = UIE2E`, in place               |
| **Contract mismatch**         | `v[[VERSION]]/contract.md` itself is incomplete or wrong                                              | Human amends the contract → re-approve → Fix Mode with `Phase = Both` (Frontend and Backend) |
| **FDS ambiguity**             | The spec is unclear or self-contradicting                                                            | Human classifies Clarification / Extension / Contradiction — see below                       |
| **Retry budget exceeded**     | A routed fix already failed once                                                                     | STOP — escalate to a human, regardless of category                                           |

Multiple findings in one diagnosis report? See **"Handling Multiple Findings"** near the end before you act on any single row above.

---

## Scenario: Backend Defect

**You'll see this when:** the diagnosis report lists a finding with category `Backend defect`, citing a specific file under `backend/src` and a Requirement ID or task ID from the plan.

**What it means:** the backend implementation doesn't do what `v[[VERSION]]/contract.md` or the FDS says it should. This is the most common outcome, and the cheapest to resolve — it's a normal bug, not a process failure.

**What to do:**

1. Run `build-mode.md` in Fix Mode with `Phase = Backend`:
   ```
   Feature ID = [[FEATURE]]
   Phase = Backend
   Mode = Fix
   Findings = <the finding ID(s), e.g. D1>
   ```
2. Do **not** re-run `build-mode.md` with `Phase = Backend` in normal Build Mode — that would re-execute the plan's entire Backend task list, redoing work that already passed and risking new regressions in parts that were fine.
3. Once the fix is committed (`git add backend/ packages/contracts/`, path-scoped as usual), re-run Integration Build (Phase 7) and both Test Build scopes (Phase 8) before returning to Code Validation 2 (Phase 8c) and Validation (Phase 9) — a backend fix can change what Integration wires or what either test suite exercises.

**What NOT to do:** don't ask the Frontend agent to "work around" a backend defect, and don't skip straight back to Validation without re-running Integration/Testing first.

---

## Scenario: Frontend Defect

**You'll see this when:** category `Frontend defect`, citing a file under `frontend/src`.

**What it means:** same idea as a Backend defect, mirrored — the UI implementation doesn't satisfy the contract, FDS, or `behavior.md`.

**What to do:** identical procedure to a Backend defect, but with `Phase = Frontend`:

```
Feature ID = [[FEATURE]]
Phase = Frontend
Mode = Fix
Findings = <the finding ID(s)>
```

Then re-run Integration (Phase 7) and both Test Build scopes (Phase 8) before Validation (Phase 9).

---

## Scenario: Integration-Wiring Defect

**You'll see this when:** category `Integration-wiring defect` — the report will note that Frontend and Backend are each individually correct against the contract, but something in how they're connected is wrong (wrong endpoint called, a response/request mapping bug, a leftover mock, an environment/config issue).

**What it means:** this isn't a Frontend or Backend problem — don't route it to either Dev Agent. It's specifically the Integration Build's own output (Phase 7) that's wrong.

**What to do:**

1. Re-run `build-mode.md` with `Phase = Integration`. Fix Mode only covers `Frontend`, `Backend` and `Both` (there is no `Phase = Integration, Mode = Fix`), so scope it yourself in the user message: name the exact defect from the finding and explicitly tell it not to redo wiring that's already correct:
   ```
   Feature ID = [[FEATURE]]
   Phase = Integration
   Fix only: <describe the specific wiring defect from the diagnosis report, e.g. "the create-expense form posts to /api/expense instead of /api/expenses">
   ```
2. This relies on the prompt's own per-item bounded fix loop rather than a formal Fix Mode instruction set — a slightly weaker scoping guarantee than Frontend/Backend Fix Mode, which is acceptable here since Integration's task list was already small and narrow to begin with.
3. Re-run both Test Build scopes (Phase 8) afterward.

---

## Scenario: Bad Test

**You'll see this when:** category `Bad test` — the report will say the test's assertion, fixture, or expectation is wrong, not the production code it's testing.

**What it means:** no code under `frontend/` or `backend/` needs to change. Don't invoke either Dev Agent.

**What to do:**

1. Re-run `test-build-mode.md` with `Phase = UnitAPI` or `Phase = UIE2E` — whichever scope originally wrote the failing test — with a user message pointing at the specific test file and what's wrong with it.
2. It rewrites the test in place, within its own existing bounded retry (3 attempts).
3. No re-run of Integration is needed — nothing in production code changed.

**What NOT to do:** don't let a test agent "fix" a bad test by loosening the assertion until it passes without understanding why it was wrong — the same discipline from the original Test Build Mode prompt applies (only change the test if you're confident it's actually wrong, not just inconvenient).

---

## Scenario: Contract Mismatch

**You'll see this when:** category `Contract mismatch` — the report will say `v[[VERSION]]/contract.md` itself is missing a field, case, or shape the FDS actually requires, and that both Frontend and Backend implemented "correctly" against a contract that didn't fully capture the requirement.

**What it means:** this is the one category where a Dev Agent fixing its own side won't actually resolve anything — the frozen interface both sides agreed on is the thing that's wrong. Neither Frontend Build nor Backend Build is allowed to silently patch the contract themselves (`build-mode.md` explicitly refuses and escalates instead, per its Strict Prohibitions) — this is intentional, not a gap.

**What to do:**

1. **Amend the contract.** Two ways, pick based on size of the change:
   - **Small, unambiguous addition** (e.g., a missing field on an existing response): a human edits `v[[VERSION]]/contract.md` directly — it's plain Markdown prose, no code, no regeneration of anything else required.
   - **Larger or unclear change**: re-invoke `plan-synthesizer.md`, scoped narrowly to amending the contract section only (not re-running `plan-fragments.md` from scratch) — cite the diagnosis finding as the reason for the amendment.
2. **Re-review and re-approve.** The amendment is made in place, in the same `v[[VERSION]]/` directory — a new version directory is only for a new FDS version. If the amended contract was edited without regenerating from the fragments, add the `SUPERSEDED` banner to both fragments (`rules/workflow.md` §6). Run `plan-review.md` again if the amendment is non-trivial (it archives the previous `review.md` to `reviews/r<N>.md` and writes a fresh, independent one; if it returns `CHANGES REQUIRED`, follow the revision loop and Revision Prompt Template in `WORKFLOW_PLAYBOOK.md`'s Phase 3), then get a fresh Developer Approval Gate (Phase 4) sign-off specifically on the amended contract. Commit it on its own (`git add features/[[FEATURE]]/plans/v[[VERSION]]/contract.md`).
3. **Fix Mode on both sides.** Once the amended contract is committed, run `build-mode.md` in Fix Mode with `Phase = Both` — the agent rolls up Frontend and Backend subagents in parallel, same as the original Build phase, each pointed at the same contract-mismatch finding (or run `Phase = Backend` then `Phase = Frontend` individually if session tokens are low):
   ```
   Feature ID = [[FEATURE]]
   Phase = Both
   Mode = Fix
   Findings = <the finding ID>
   ```
4. Re-run Integration (Phase 7) and both Test Build scopes (Phase 8) afterward.

**What NOT to do:** don't let either Dev Agent "work around" a contract gap by inventing its own shape — that's exactly what re-creates the original single-agent problem this whole design exists to prevent (Frontend and Backend silently diverging on what the interface is).

---

## Scenario: FDS Ambiguity

**You'll see this when:** category `FDS ambiguity` — the report will say the requirement itself is unclear or self-contradicting once real behavior was exercised, not that the code is wrong relative to a clear spec.

**What it means:** this is the most expensive category, and the only one where the Diagnosis Agent's proposed classification is not the final word — a human decides which of three things this actually is, per `rules/workflow.md §4`:

| Sub-classification | Definition                                                              | What happens                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clarification**   | The gap was always implied by the FDS, just not written down explicitly | Document an addendum to the FDS in-place. No restart.                                                                                                                                                                    |
| **Extension**       | A genuinely new requirement, not implied by the original FDS            | New FDS version (bump the version, add a changelog entry), planned in a new sibling `v<new-version>/` directory. Restart from Plan Fragments (Phase 1) — scoped only to the delta, if the plan-mode Scenario B logic applies. |
| **Contradiction**   | The FDS is internally inconsistent                                      | New FDS version, restart from Phase 1, and get stakeholder review before re-approving — this is the most expensive path for a reason; don't skip the stakeholder step to save time.                                      |

**What to do:**

1. Read the Diagnosis Agent's proposed classification, but verify it yourself against the actual FDS text before acting on it.
2. If Clarification: edit `fds.md` to add the addendum, note it in the changelog frontmatter, and decide case-by-case whether the affected Dev Agent(s) need a small Fix Mode pass to align with the clarified wording (usually yes, since the code was built against the ambiguous version).
3. If Extension or Contradiction: treat this as a fresh Phase 1 — new FDS version, `plan-fragments.md` re-run with `Phase = Both` against the new scope, full pipeline from there.

**What NOT to do:** don't let this get silently reclassified as a "Backend defect" or "Frontend defect" just because it's cheaper to fix that way — if the spec itself is genuinely ambiguous, patching the code without fixing the spec just reintroduces the same ambiguity next time this feature changes.

---

## Scenario: Retry Budget Exceeded

**You'll see this when:** a finding in the diagnosis report is marked "Retry budget exceeded" instead of one of the six categories above — meaning a routed fix for this exact finding already ran once (per its category's normal procedure) and failed again.

**What it means:** whatever caused this either isn't well understood yet, or isn't the kind of problem this workflow's bounded-retry model is designed to resolve automatically. Continuing to retry under the same category is unlikely to help and risks the "LLM output oscillates and degrades beyond 3 attempts" failure mode `rules/workflow.md §8` already warns about.

**What to do:** stop. Escalate to a human for direct investigation — this is not a case for re-running any agent again under its normal fix procedure. A human may discover the finding was actually mis-classified (e.g., what looked like a Backend defect is really an FDS ambiguity), in which case restart from the correct scenario above, not from another retry of the same one.

---

## Handling Multiple Findings

A single Diagnosis Mode run commonly reports several findings at once, since Testing runs as two disjoint scopes (Unit/API and UI/E2E — as sub-agents of one `Phase = Both` session, or as two individually-run sessions — each with its own defects file, `defects-unit-api.md` and `defects-ui-e2e.md`). Before acting on any individual scenario above, check the diagnosis report's **Batching Summary**:

- **Multiple findings routed to the same agent** (e.g., two separate Backend defects): fix them in **one** Fix Mode session, naming all the finding IDs together (`Findings = D1, D3`). Never invoke the same agent twice in a row for two different findings from the same diagnosis pass — that risks the second session's edits conflicting with or undoing the first's, in a working tree that may not have been re-synced in between.
- **Findings routed to different agents** (a Backend defect and a Frontend defect from the same pass): run one Fix Mode session with `Phase = Both` and every finding ID (e.g. `Findings = D1, D2, D3`) — the agent rolls up a Frontend and a Backend subagent, each fixing only its own layer's findings, exactly like the original Build phase: disjoint paths, same `git status`-then-path-scoped-commit discipline. If session tokens are low, run the layers one at a time with `Phase = Backend` then `Phase = Frontend` instead, committing in between.
- **A Contract-mismatch finding alongside other findings**: resolve the contract amendment first, before running Fix Mode for anything else in the same batch. A Backend or Frontend fix made against a contract that's about to change may be wasted work once the amendment lands.
- **An FDS-ambiguity finding alongside other findings**: resolve the classification (Clarification / Extension / Contradiction) first if it's plausible the other findings are downstream symptoms of the same ambiguity — check before assuming they're independent.

---

## After Any Fix

Regardless of which scenario you followed, before moving on:

1. Confirm the Fix Mode / re-run commit is path-scoped (`git status` first), never `git add -A` while any other session might still be in flight.
2. Re-run Integration Build (Phase 7) and both Test Build scopes (Phase 8) if the fix touched `frontend/`, `backend/`, or `v[[VERSION]]/contract.md` — skip this only for a pure Bad-test fix, which doesn't touch production code.
3. Once Testing is green again, proceed to Code Validation 2 (Phase 8c, the SonarQube Full Gate), then re-run Validation Mode (Phase 9).
4. Check `features/[[FEATURE]]/plans/activity-log.md` — every planning, review, test and diagnosis agent involved should have appended its own line (Integration and Validation are logged by hand); a missing entry is worth investigating before you trust the fix landed cleanly.
