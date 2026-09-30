# Feature Implementation Playbook — Multi-Agent Workflow

This document is the operational guide for developing any feature (`[[FEATURE]]`, e.g. `expense-crud`) under the **Staged Dual-Validation Workflow with Multi-Agent Parallel Execution**.

Replace `[[FEATURE]]` with the actual feature name (e.g. `expense-crud`). `[[VERSION]]` is the plan version (e.g. `1.0.0`).

Small, simple features do not require the full multi-agent pipeline — see [When to Use the Simple Path Instead](#when-to-use-the-simple-path-instead) at the end. Base prompts (`.ai/prompts/build-mode.md` and `.ai/prompts/validation-prompt.md`) remain available for single-agent or sequential workflows.

---

## Workflow Lifecycle at a Glance

```
0. Spec & Catalog Registration ──► pnpm index:sync ──► pnpm index:verify
   (FDS, Behavior, Visuals)                                     │
                                                                ▼
1. Plan Fragments (plan-fragments.md)
   • Phase = Both: Frontend || Backend subagents
   • or Phase = Frontend / Backend individually
                │
                ▼
2. Plan Synthesizer  ──────────► v[[VERSION]]/plan.md
                │                v[[VERSION]]/contract.md (technology-agnostic API Contract spec)
                ▼
3. Plan Review (independent agent)  ──► v[[VERSION]]/review.md (reviews both files)
                │
                ▼
4. Developer Approval Gate  (Commit Plan + Contract)
                │            freezes: FDS, behavior, visual specs, plan, v[[VERSION]]/contract.md
                │
                ▼
5. Build Mode (.ai/prompts/build-mode.md)
   • Parallel Execution: Phase = Both (Session A: Frontend || Session B: Backend)
   • Pragmatic Choice (Low Tokens): Phase = Frontend or Phase = Backend individually
                │
                ▼
6. UI Review & Freeze  (Verify visual design against visuals/ and freeze UI)
                │
                ▼
7. Integration Build Mode (.ai/prompts/build-mode.md with Phase = Integration)
                │
                ▼
   7b. Code Validation 1 — SonarQube Static Gate + Fix Loop
                │
                ▼
8. Test Build Mode (test-build-mode.md)
   • Phase = Both: Unit/API || UI/E2E subagents
   • or Phase = UnitAPI / UIE2E individually
                │
       (Commit Tests & Fixes)
                │
                ▼
   8b. Diagnosis & Fix Loop (.ai/prompts/diagnosis-mode.md)
                │
                ▼
   8c. Code Validation 2 — SonarQube Full Gate + Fix Loop
                │
                ▼
9. Validation Mode (.ai/prompts/validation-prompt.md)
```

---

## A Note on Committing Parallel Work

Whenever two agents work in the same working tree concurrently, running `git add -A` is unsafe as it may capture incomplete files from another agent. Every commit instruction below stages **only the paths the specific phase owns**:

- **Frontend Build**: stages only `frontend/`
- **Backend Build**: stages only `backend/` and `packages/contracts/`
- **Testing**: stages `backend/`, `frontend/`, and `features/[[FEATURE]]/plans/` — one combined commit once both scopes are done, whether they ran as `Phase = Both` subagents in one session or as two individually-run sessions

Always run `git status` prior to committing to verify staged changes stay strictly within the assigned boundary.

---

## A Note on the Activity Log

Every agent appends one line to `features/[[FEATURE]]/plans/activity-log.md` upon completion (creating the file if it does not exist). This provides an audit trail:
`- <Phase Name> | <YYYY-MM-DD HH:mm> | files touched: <paths> | result: <done / failed / notes>`

For phases that use base prompts (Integration, Validation), add the log entry manually before committing.

Exception: when Phase 1 (Plan Fragments) or Phase 8 (Test Build Mode) runs with `Phase = Both`, the two subagents do not write to the log (concurrent appends to the same file could race); the orchestrating agent appends both lines after the subagents return.

---

## Phase 0: Specification Definition & Catalog Registration

Before invoking any AI planning agent, the developer establishes the source of truth for the feature by authoring its specifications and registering it in the project catalog.

### 1. Author Feature Specifications

Create the feature directory under `features/[[FEATURE]]/`:

- **Feature Design Specification (`features/[[FEATURE]]/fds.md`)**:
  Must include standard YAML frontmatter, functional requirements, validation rules, data model, and acceptance criteria:

  ```markdown
  ---
  id: [[FEATURE]]
  version: 1.0.0
  status: draft
  changelog:
    - version: 1.0.0
      date: YYYY-MM-DD
      summary: "Initial draft of [[FEATURE]] specification"
  ---

  # Feature Design Specification: [[FEATURE]]

  ## Description

  ...

  ## Functional Requirements

  - REQ-[[PREFIX]]-01: ...
  - REQ-[[PREFIX]]-02: ...

  ## Validation Rules

  1. Field constraints (types, min/max lengths, regex, positive numbers)...

  ## Data Model

  | Field | Type        | Required | Description |
  | :---- | :---------- | :------- | :---------- |
  | id    | UUID/string | Yes      | Primary key |

  ## Acceptance Criteria

  - Criteria 1...
  ```

- **Behavioral Specification (`features/[[FEATURE]]/behavior.md`)**:
  Documents user interactions and edge states:
  - Form submission, cancellation, and validation UX (inline error states).
  - Empty states (with CTA) and loading states (skeleton loaders, mutation spinners).
  - Toast notifications for success and failure.
  - Confirmation dialogs for destructive actions (e.g. deletion).

- **Visual & Design Specifications (`features/[[FEATURE]]/visuals/`)**:
  - `features/[[FEATURE]]/visuals/figma.md`: Layout dimensions, spacing, grid, color tokens, typography, and component states.
  - UI assets: Screenshots, wireframes, or mockup diagrams (e.g. `features/[[FEATURE]]/visuals/[[FEATURE]].png`).

---

### 2. Register Feature in `features/index.json`

Add the feature entry under `active_features` in `features/index.json`:

```json
"[[FEATURE]]": {
  "id": "[[FEATURE]]",
  "title": "Feature Title",
  "domain": "finance",
  "status": "active",
  "version": "1.0.0",
  "path": "features/[[FEATURE]]/fds.md",
  "behavior_spec": "features/[[FEATURE]]/behavior.md",
  "figma_spec": "features/[[FEATURE]]/visuals/figma.md",
  "visual_spec": [
    "features/[[FEATURE]]/visuals/[[FEATURE]].png"
  ],
  "owner": "feature-team",
  "dependencies": []
}
```

---

### 3. Run Index Automation Scripts

Run the index scripts to update metrics and verify that all specifications are completely consistent:

```bash
# 1. Recalculates total, active, and archived counts and updates features/index.json
pnpm index:sync

# 2. Validates that all files exist on disk, versions match the FDS frontmatter, and references are consistent
pnpm index:verify
```

> [!IMPORTANT]
> `pnpm index:verify` must exit with `0` (clean) before you proceed to Phase 1. If any missing files, version mismatches, or invalid dependencies are reported, fix them first.

---

### 4. Commit Feature Specifications

Once verification passes, commit the specifications:

```bash
git add features/[[FEATURE]]/ features/index.json
git commit -m "docs([[FEATURE]]): add feature specifications and register in catalog"
```

---

## Phase 1: Plan Mode — Frontend & Backend Fragments

Frontend and backend planning require different contextual focus (UI/interaction vs data model/domain rules). Drafting them independently and merging surfaces interface discrepancies before code is written. Both fragments come from the single prompt `.ai/prompts/plan/plan-fragments.md`, selected with `Phase`.

### Multi-Agent Parallel Execution: `Phase = Both`

When `Phase = Both` is provided, the prompt instructs the AI agent to employ a multi-agent pattern and roll up two parallel subagents in a single session:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/plan/plan-fragments.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  Phase = Both
  ```

#### Subagents Rolled Up:

1. **Frontend Subagent**: Reads `fds.md`, `behavior.md`, `visuals/`, and `frontend/src`. Drafts the frontend fragment only.
2. **Backend Subagent**: Reads `fds.md`, `backend/src`, and `packages/contracts/src`. Drafts the backend fragment only.

Each subagent starts with its own fresh context and never sees the other's output. The orchestrating agent launches both subagents with a write-capable agent type (read-only types cannot save the fragment), verifies both files exist, and appends both `activity-log.md` lines itself (subagents do not write to the log, to avoid concurrent appends). It does not run the Synthesizer.

---

### Developer's Pragmatic Choice: Individual Layer Run (When Session Tokens Are Low)

Pass `Phase = Frontend` or `Phase = Backend` to run one focused agent without spawning subagents, in separate sessions if desired:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/plan/plan-fragments.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  Phase = Frontend   (or Backend)
  ```

---

### What Happens:

- The Frontend fragment is written to `features/expense-crud/plans/v[[VERSION]]/fragments/frontend.md`.
- The Backend fragment is written to `features/expense-crud/plans/v[[VERSION]]/fragments/backend.md`.
- All fragment drafting is read-only with respect to source code and specifications.

---

## Phase 2: Plan Synthesizer

Run in a new session after both fragments are generated:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/plan/plan-synthesizer.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  ```

### What Happens:

- Agent reconciles both fragments and produces:
  1. `features/expense-crud/plans/v[[VERSION]]/plan.md` (the unified implementation plan)
  2. `features/expense-crud/plans/v[[VERSION]]/contract.md` (canonical, technology-agnostic API Contract specification: endpoints, request/response structures, and status codes in Markdown prose).

---

## Phase 3: Plan Review

Run in a new session with an independent agent:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/plan/plan-review.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  ```

### What Happens:

- Evaluates the synthesized plan and contract against `rules/architecture.md`, `rules/conventions.md`, and `rules/tech-stack.md`.
- Produces `features/expense-crud/plans/v[[VERSION]]/review.md` with a verdict (`PASS` or `CHANGES REQUIRED`).

### Action:

- If `CHANGES REQUIRED`: Address findings via Plan Synthesizer or fragments, revising `plan.md` and `contract.md` **in place** in the same `v[[VERSION]]/` directory (do not bump the version), then re-review in a new session. The reviewer archives the previous `review.md` to `reviews/r<N>.md` automatically; `review.md` is always the latest.
- If fragments were not regenerated for a revision, add the `SUPERSEDED` banner to both (see `rules/workflow.md` §6, Plan Artifact Layout).
- If `PASS`: Proceed to Developer Approval Gate.

### Revision Prompt Template

The review's **Suggested Next Step** section proposes a ready-to-paste prompt. Check it, fill in any `DECISION NEEDED` slots, and run it. The reviewer only proposes; the developer decides.

**Obvious fix** (the spec dictates one answer):

```text
System prompt : .ai/prompts/plan/plan-synthesizer.md
User message  : Feature ID = expense-crud
                Revision run. Plan Review (features/expense-crud/plans/v[[VERSION]]/review.md)
                returned CHANGES REQUIRED.
                Blocking finding B-1: <what is missing or wrong, citing the plan section
                and the FDS section>. <exact change wanted>.
                Revise plan.md and contract.md in place. Do not change other sections.
```

**Developer decision** (two or more valid options). Write the decision down first, then point the agent at it:

```text
# features/expense-crud/plans/v[[VERSION]]/directives.md
## B-2 <short title>
Options considered: <A>, <B>
Decision: <the developer's choice>
Apply to: <tasks, contract rows, tests>
Record as a starred (★) decision in the plan's Decision Log: yes/no
```

```text
System prompt : .ai/prompts/plan/plan-synthesizer.md
User message  : Feature ID = expense-crud
                Revision run. Apply every decision in
                features/expense-crud/plans/v[[VERSION]]/directives.md.
                Revise plan.md and contract.md in place.
```

If only one side is affected, patch that fragment first (`plan-fragments.md` with `Phase = Frontend` or `Backend`), then run the synthesizer. After the revision, run Plan Review again in a new session. If the review says the specs themselves are ambiguous, no revision prompt is produced: decide the requirement, edit `fds.md` or `behavior.md`, then re-draft the affected fragments.

---

## Phase 4: Developer Approval Gate

### Action:

1. Review `v[[VERSION]]/plan.md`, `v[[VERSION]]/contract.md`, and `v[[VERSION]]/review.md`.
2. Confirm the Plan Review verdict is `PASS`.
3. Confirm `v[[VERSION]]/contract.md` is complete and technology-agnostic.

### Commit:

```bash
git add -A && git commit -m "docs(expense-crud): add approved implementation plan and contract"
```

All specifications (`fds.md`, `behavior.md`, `visuals/`, `v[[VERSION]]/plan.md`, and `v[[VERSION]]/contract.md`) are now **frozen**.

---

## Phase 5: Build Mode — Frontend & Backend Execution

Because `v[[VERSION]]/contract.md` is frozen at the Approval Gate, data consistency across layers is strictly defined. Frontend and Backend can be executed in parallel using `.ai/prompts/build-mode.md`.

### Multi-Agent Parallel Execution: `Phase = Both`

When `Phase = Both` is provided, the prompt instructs the AI agent to employ a multi-agent pattern and roll up two parallel subagents:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/build-mode.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  Phase = Both
  ```

#### Subagents Rolled Up:

1. **Frontend Subagent**: Scoped strictly to `frontend/`. Implements UI components against mock data shaped to match `v[[VERSION]]/contract.md`.
2. **Backend Subagent**: Scoped strictly to `backend/` and `packages/contracts/`. Generates typed contracts from `v[[VERSION]]/contract.md` and implements schemas, services, repositories, and routes in `backend/`.

_Data consistency across both subagents is strictly governed by the frozen `v[[VERSION]]/contract.md` spec._

---

### Developer's Pragmatic Choice: Individual Layer Run (When Session Tokens Are Low)

The developer makes the pragmatic decision prior to invoking the AI: if remaining session tokens are low, or if the developer prefers to stage implementation incrementally, they pass `Phase = Frontend` or `Phase = Backend` individually to run a single focused agent without spawning subagents:

1. **Turn 1 — Frontend**: Run `.ai/prompts/build-mode.md` with `Phase = Frontend`. The agent focuses strictly on UI components and mock data without burning tokens on backend files.
2. **Phase 6 — UI Review & Freeze**: Verify visual styling against `visuals/` and commit `frontend/`.
3. **Turn 2 — Backend**: Run `.ai/prompts/build-mode.md` with `Phase = Backend`. The agent focuses strictly on contracts, Drizzle schemas, repositories, and Express routes.

---

### What Happens:

- **Frontend tasks**: Builds UI components against mock data shaped to match `v[[VERSION]]/contract.md`. Writes strictly to `frontend/`.
- **Backend tasks**: Generates/updates ts-rest contract definitions under `packages/contracts/` from `v[[VERSION]]/contract.md`, then implements Drizzle schemas, repositories, services, and Express routes. Writes strictly to `backend/` and `packages/contracts/`.

### Commits:

Each phase/session commits cleanly:

```bash
# Frontend (once finished and UI Review in Phase 6 is complete):
pnpm format
git status
git add frontend/
git commit -m "feat(expense-crud): frontend build complete and UI frozen"
```

```bash
# Backend (once finished):
pnpm format
git status
git add backend/ packages/contracts/
git commit -m "feat(expense-crud): backend build complete"
```

---

## Phase 6: UI Review & Freeze

Can be executed as soon as Frontend Build is complete, without waiting for Backend Build (since the frontend runs on mocks):

1. Start frontend dev server (`pnpm --filter @expense-tracker/frontend dev`) and inspect the feature pages.
2. Verify visual styling, responsive design, modals, form states, and empty states against visual specs.
3. Once verified, freeze UI and complete the Frontend commit shown above.

---

## Phase 7: Integration Build Mode

Runs sequentially after both Frontend and Backend are committed.

### Claude Code Prompt:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/build-mode.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  Phase = Integration
  ```

### What Happens:

- Replaces frontend mock data with real API calls using the `@expense-tracker/contracts` ts-rest client.
- Connects React Hook Form submissions, TanStack Query mutations, and error toasts.
- Purges mock data files from production paths.

### Commit:

```bash
pnpm format
git add -A && git commit -m "feat(expense-crud): integration build complete"
```

### Action:

Append to `features/expense-crud/plans/activity-log.md`:
`- Build: Integration | <YYYY-MM-DD HH:mm> | files touched: frontend/**, backend/** | result: done`

---

## Phase 7b: Code Validation 1 — SonarQube Static Gate

Runs after Integration Build is committed, prior to writing tests:

1. Run the local SonarQube **Static Analysis Gate** scan (no coverage threshold required at this phase).
2. If zero blocker or critical issues are found, proceed to Phase 8.
3. If issues exist, address them within the 3-attempt retry limit.
4. Record status in `features/expense-crud/plans/activity-log.md`:
   `- Code Validation 1 | <YYYY-MM-DD HH:mm> | sonar static gate: pass | result: done`

---

## Phase 8: Test Build Mode — Unit/API & UI/E2E

Post-implementation test generation driven by `fds.md` and `behavior.md`.

### Multi-Agent Parallel Execution: `Phase = Both`

When `Phase = Both` is provided, the prompt instructs the AI agent to employ a multi-agent pattern and roll up two parallel subagents in a single session, exactly as Phase 1 and Phase 5 do:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/test-build-mode.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature = expense-crud
  Phase = Both
  ```

#### Subagents Rolled Up:

1. **Unit/API Test Subagent**: Scoped strictly to `backend/`. Writes backend unit and API/integration tests, and its own `v[[VERSION]]/defects-unit-api.md` if a genuine defect is found.
2. **UI/E2E Test Subagent**: Scoped strictly to `frontend/` and `e2e/`. Writes frontend component and Playwright E2E tests, and its own `v[[VERSION]]/defects-ui-e2e.md` if a genuine defect is found.

Each subagent starts with its own fresh context and never sees the other's output. The orchestrating agent launches both subagents with a write-capable agent type, verifies both scopes' test files exist, and appends both `activity-log.md` lines itself (subagents do not write to the log, to avoid concurrent appends).

---

### Developer's Pragmatic Choice: Individual Scope Run (When Session Tokens Are Low)

Pass `Phase = UnitAPI` or `Phase = UIE2E` to run one focused agent without spawning subagents, in separate sessions if desired:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/test-build-mode.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature = expense-crud
  Phase = UnitAPI   (or UIE2E)
  ```

### Commit:

Once both scopes finish and all tests pass:

```bash
pnpm format
git status
git add backend/ frontend/ e2e/ features/expense-crud/plans/
git commit -m "test(expense-crud): test build complete (unit/API + UI/E2E, parallel)"
```

---

## Phase 8b: Diagnosis & Fix Loop (On Unresolved Failures)

If Phase 8 reports failures that cannot be resolved within the test agents' bounded retries, or if cross-boundary defects are surfaced. See `defect-scenarios-playbook.md` for the developer-facing runbook covering exactly what to do for each of the six diagnosed categories — this section covers only how to invoke Diagnosis Mode itself.

### Step 1: Run Diagnosis Agent

- **System Prompt**:
  ```text
  Read the file .ai/prompts/diagnosis-mode.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature ID = expense-crud
  ```

Produces `features/expense-crud/plans/v[[VERSION]]/diagnosis.md`, classifying each failure into one of six categories with concrete Suggested Next Steps:

| Category                      | Routing & Action                                                                           |
| :---------------------------- | :----------------------------------------------------------------------------------------- |
| **Backend defect**            | Run `.ai/prompts/build-mode.md` (`Phase = Backend`, `Mode = Fix`)                          |
| **Frontend defect**           | Run `.ai/prompts/build-mode.md` (`Phase = Frontend`, `Mode = Fix`)                         |
| **Integration-wiring defect** | Re-run `.ai/prompts/build-mode.md` (`Phase = Integration`) scoped to the wiring issue      |
| **Bad test**                  | Re-run responsible test prompt to rewrite the faulty test in place                         |
| **Contract mismatch**         | Amend `v[[VERSION]]/contract.md`, re-approve at Approval Gate, and re-run build sessions   |
| **FDS ambiguity**             | Escalate to human per `rules/workflow.md §4` (Clarification vs Extension vs Contradiction) |

---

### Step 2: Sequencing Rule — Contract Mismatches First

Before running Fix Mode on any source code, check the diagnosis report's **Batching Summary**:

- If a **Contract Mismatch** finding is present alongside Frontend or Backend defects:
  1. Amend `v[[VERSION]]/contract.md` to reflect the required field/schema changes.
  2. Re-approve and freeze the contract at the Developer Approval Gate.
     _Never fix code against a contract that is about to change; resolving the contract first prevents wasted rework._

---

### Step 3: Handling Simultaneous Frontend & Backend Defects

When the diagnosis report lists defects across both layers (e.g. Frontend: `D1, D3`, Backend: `D2`), select your execution strategy:

#### Strategy A: Multi-Agent Parallel Fix (`Phase = Both`)

The primary AI agent employs a multi-agent pattern and rolls up two concurrent subagents:

```text
System prompt : .ai/prompts/build-mode.md
User message  : Feature ID = expense-crud
                Phase = Both
                Mode = Fix
                Findings = D1, D2, D3
```

- **Frontend Subagent**: Resolves `D1, D3` strictly within `frontend/`.
- **Backend Subagent**: Resolves `D2` strictly within `backend/` and `packages/contracts/`.

#### Strategy B: Pragmatic Sequential Fix (When Session Tokens Are Low)

If token budget is constrained, run them individually in focused turns:

1. **Backend Fix**:
   ```text
   System prompt : .ai/prompts/build-mode.md
   User message  : Feature ID = expense-crud
                   Phase = Backend
                   Mode = Fix
                   Findings = D2
   ```
   Commit backend fixes:
   ```bash
   pnpm format
   git status
   git add backend/ packages/contracts/
   git commit -m "fix(expense-crud): resolve backend defect D2"
   ```
2. **Frontend Fix**:
   ```text
   System prompt : .ai/prompts/build-mode.md
   User message  : Feature ID = expense-crud
                   Phase = Frontend
                   Mode = Fix
                   Findings = D1, D3
   ```
   Commit frontend fixes:
   ```bash
   pnpm format
   git status
   git add frontend/
   git commit -m "fix(expense-crud): resolve frontend defects D1, D3"
   ```

> [!TIP]
> **Batching Rule**: Always batch multiple findings for the same layer into **one** Fix Mode session (e.g. `Findings = D1, D3`). Never run separate sessions back-to-back for individual findings on the same layer without staging in between, as subsequent edits may overwrite or conflict with earlier fixes.

---

### Step 4: Post-Fix Verification Loop

Regardless of which strategy was used:

1. **Re-run Integration Build (Phase 7)**:
   ```text
   System prompt : .ai/prompts/build-mode.md
   User message  : Feature ID = expense-crud
                   Phase = Integration
   ```
   _Commit integration wiring changes if any were updated._
2. **Re-run Parallel Testing (Phase 8)**:
   Re-run `test-build-mode.md` with `Phase = Both` (or both individual scopes) to verify that all defects are eliminated and zero regressions were introduced.
3. Once all tests pass, proceed to **Phase 8c (SonarQube Full Gate)** and **Phase 9 (Validation Mode)**.

---

## Phase 8c: Code Validation 2 — SonarQube Full Gate

Runs once Phase 8 and any defect fixes are committed:

1. Run the local SonarQube **Full Quality Gate** scan (static analysis + line coverage per `coverage_target` in `fds.md` frontmatter, typically >80%).
2. Resolve any static analysis issues. If coverage is short, route back to the appropriate test agent.
3. Record status in `features/expense-crud/plans/activity-log.md`:
   `- Code Validation 2 | <YYYY-MM-DD HH:mm> | sonar full gate: pass | result: done`

---

## Phase 9: Validation Mode (Final Audit)

Final compliance audit verifying all requirements and acceptance criteria.

### Claude Code Prompt:

- **System Prompt**:
  ```text
  Read the file .ai/prompts/validation-prompt.md and follow it exactly. That is your system prompt.
  ```
- **User Message**:
  ```text
  Feature = expense-crud
  ```

### What Happens:

- Agent checks all FDS criteria, validates architecture adherence, executes automated checks, and generates `features/expense-crud/validation-report.md`.

### Commit:

```bash
pnpm format
git add -A && git commit -m "docs(expense-crud): add final validation report"
```

Append final entry to `features/expense-crud/plans/activity-log.md`:
`- Validation | <YYYY-MM-DD HH:mm> | output: validation-report.md | result: pass`

---

## When to Use the Simple Path Instead

Use the complexity scoring rubric in `rules/workflow.md §5` to select the workflow depth:

- **Low complexity (Score 0–2)**: Single component, no API contract changes. Use the simple sequential path:
  - Plan: `.ai/prompts/plan-mode.md`
  - Build: `.ai/prompts/build-mode.md` (`Phase = Frontend` → `Backend` → `Integration` sequentially)
  - Validate: `.ai/prompts/validation-prompt.md`
- **Medium complexity (Score 3–4)**: Adopt Plan Review (`plan-review.md`) and parallel Testing (`test-build-mode.md` with `Phase = Both`), but keep Build sequential.
- **High complexity (Score 5–6)**: Full multi-agent pipeline detailed above with parallel plan fragments, plan review, parallel builds (`Phase = Both`), and parallel test execution.

---

## Summary of All AI Prompts

| File                                           | Role                                                                                                   |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `.ai/prompts/plan/plan-fragments.md`           | Unified fragment prompt supporting `Phase: "Frontend"` \| `"Backend"` \| `"Both"` (parallel subagents) |
| `.ai/prompts/plan/plan-synthesizer.md`         | Synthesizes fragments into `v<version>/plan.md` and `v<version>/contract.md`                           |
| `.ai/prompts/plan/plan-review.md`              | Independent pre-approval review of plan and API contract                                               |
| `.ai/prompts/plan-mode.md`                     | Baseline single-agent plan mode for simple path / low-complexity features                              |
| `.ai/prompts/build-mode.md`                    | Unified build prompt supporting `Phase: "Frontend"` \| `"Backend"` \| `"Both"` \| `"Integration"`      |
| `.ai/prompts/test-build-mode.md`               | Unified test prompt supporting `Phase: "UnitAPI"` \| `"UIE2E"` \| `"Both"` (parallel subagents)         |
| `.ai/prompts/diagnosis-mode.md`                | Classifies test/validation failures into 6 categories with concrete routing                            |
| `.ai/prompts/validation-prompt.md`             | Baseline validation prompt used for Phase 9 final audit and compliance report                          |
