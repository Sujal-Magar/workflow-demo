# Workflow & Specification Decisions

This document defines the official **Staged Dual-Validation Workflow** for the Expense Tracker project.

---

## 1. Workflow Overview

```
Phase 0: FDS + Visual Design + Behavior Spec + Catalog Registration   (human-authored)
        │
        ▼
Phase 1: Plan Fragments  ← Frontend || Backend (Phase = Both subagents, or individually)
        │ → outputs v<version>/fragments/frontend.md, v<version>/fragments/backend.md
        ▼
Phase 2: Plan Synthesizer      → v<version>/plan.md, v<version>/contract.md
        │
        ▼
Phase 3: Plan Review (independent agent)  → v<version>/review.md
        │ CHANGES REQUIRED: revise plan/contract in place, re-review (bounded loop)
        ▼ PASS
Phase 4: Developer Approval Gate     ← human reviews plan + contract; all specs frozen here
        │
        ▼
Phase 5: Build Mode           ← Frontend || Backend (Phase = Both subagents, or individually)
        │ → lint + typecheck after every task (3-attempt self-correction)
        ▼
Phase 6: UI Review & Freeze   ← human/LLM confirms UI against visual spec
        │   (can start as soon as Frontend alone is done — it runs on mocks)
        │ → UI design and components frozen
        ▼
Phase 7: Integration Build Mode       ← replaces frontend mocks with real backend calls
        │ → lint + typecheck after every task (3-attempt self-correction)
        ▼
Phase 7b: Code Validation 1            ← SonarQube Static Analysis Gate (no coverage threshold)
        │ → fix issues; bounded 3-attempt retry
        ▼
Phase 8: Test Build Mode      ← Unit/API || UI/E2E (Phase = Both subagents, or individually)
        │ → no production code modifications unless a documented defect is found
        ▼
Phase 8b: Diagnosis & Fix Loop  ← classifies each unresolved failure and routes it; never fixes directly
        │ → routed fix, then re-run Integration + Test Build Mode
        ▼
Phase 8c: Code Validation 2            ← SonarQube Full Quality Gate (static + coverage)
        │ → fix issues; bounded 3-attempt retry
        ▼
Phase 9: Validation                   → Validation Report (ephemeral by default)
```

---

## 2. Phase Definitions

### Phase 0 — Spec & Catalog Registration

- **Role**: Human authors the feature's source of truth and registers it in the project catalog, before any planning agent runs.
- **Action**: Author `fds.md`, `behavior.md`, `visuals/` under `features/<id>/`; add the feature to `features/index.json`; run `pnpm index:sync` then `pnpm index:verify`.
- **Exit criteria**: `pnpm index:verify` exits clean (no missing files, version mismatches, or invalid dependencies).

### Phase 1 — Plan Fragments (`.ai/prompts/plan/plan-fragments.md`)

- **Role**: Read-only fragment drafter. `Phase = Both` rolls up a Frontend subagent and a Backend subagent from one orchestrating session, each with its own fresh context, writing only its own fragment; `Phase = Frontend` or `Phase = Backend` runs one side individually when session tokens are low.
- **Input**: `fds.md`, `behavior.md`, `visuals/` (Frontend); `fds.md`, existing contracts (Backend); `rules/`
- **Output**: `features/<id>/plans/v<version>/fragments/frontend.md` and `.../fragments/backend.md`
- **Exit criteria**: Both fragments exist and are non-empty (or, if one subagent stopped on an ambiguity, the other's fragment is kept and the ambiguity is surfaced).

### Phase 2 — Plan Synthesizer (`.ai/prompts/plan/plan-synthesizer.md`)

- **Role**: Merges both fragments into one implementation plan and a technology-agnostic API contract. Has no access to the fragment authors' reasoning — only their written output.
- **Output**: `features/<id>/plans/v<version>/plan.md` and `features/<id>/plans/v<version>/contract.md`
- **Exit criteria**:
  - Implementation Plan covers all FDS requirements with spec-traced atomic tasks.
  - All known ambiguities at planning time are resolved and documented.
  - Zero conflicts between FDS and `rules/`.

### Phase 3 — Plan Review (`.ai/prompts/plan/plan-review.md`)

- **Role**: Independent audit of `v<version>/plan.md` and `v<version>/contract.md` against `rules/*` and `fds.md`, before any code is written. Forbidden from reading prior chat transcripts, session notes, commit messages, or earlier reviews — judges the written text only.
- **Output**: `v<version>/review.md` with a verdict of `PASS` or `CHANGES REQUIRED`; any existing `review.md` is archived to `reviews/r<N>.md` first.
- **Exit criteria**: Verdict is `PASS`. On `CHANGES REQUIRED`, the plan/contract are revised in place (Phase 2, or the affected fragment in Phase 1) and re-reviewed, bounded by the retry policy in §8.

### Phase 4 — Developer Approval Gate

- **Role**: Human review checkpoint after planning, before any code is written.
- **Action**: Developer confirms the Phase 3 verdict is `PASS`, reviews `features/<id>/plans/v<version>/plan.md` and `v<version>/contract.md`, and approves.
- **On approval**: All specs (`fds.md`, `behavior.md`, `visuals/`, `v<version>/plan.md`, `v<version>/contract.md`) are frozen. No changes permitted without creating a new version and restarting planning, except a Clarification addendum (§4 below).
- **Exit criteria**: Explicit human approval is recorded.

### Phase 5 — Build Mode (`.ai/prompts/build-mode.md`)

- **Role**: Implements Frontend and Backend against the frozen plan and contract. `Phase = Both` rolls up a Frontend subagent (scoped to `frontend/`) and a Backend subagent (scoped to `backend/` and `packages/contracts/`) from one orchestrating session; `Phase = Frontend` or `Phase = Backend` runs one side individually when session tokens are low.
- **Rules**:
  - Frontend builds UI components against mock data shaped to match the frozen contract. No real backend calls.
  - Backend generates the typed contract package from `v<version>/contract.md`, then implements schemas, repositories, services, and routes (Presentation → Service → Repository → Database) to satisfy the FDS.
  - Neither side may modify `v<version>/contract.md`; if it looks incomplete or ambiguous, stop and report.
  - Runs `pnpm lint` + `pnpm typecheck` after every task.
  - 3-attempt self-correction loop per task.
- **Exit criteria**: Lint and typecheck pass. All tasks for the run layer(s) complete. API shapes match contract definitions.

### Phase 6 — UI Review & Freeze

- **Role**: Human or LLM visual review of the frontend against the visual spec. Can start as soon as Frontend Build alone is complete — it runs on mocks and has no dependency on Backend's progress.
- **Evaluation criteria**: Each acceptance criterion in `visuals/` must be confirmed as satisfied or explicitly noted as deferred.
- **On freeze**: UI design and component behavior are frozen.
- **Exit criteria**: Reviewer explicitly signs off. UI is frozen.

### Phase 7 — Integration Build Mode (`.ai/prompts/build-mode.md` with `Phase = Integration`)

- **Role**: Replaces frontend mock data with real backend API calls via ts-rest client. Runs once both Frontend and Backend are committed.
- **Rules**:
  - Implements only tasks marked `layer: integration` in the approved plan.
  - Runs `pnpm lint` + `pnpm typecheck` after every task.
  - 3-attempt self-correction loop per task.
- **Exit criteria**: Lint and typecheck pass. All integration tasks complete. No mock data remaining in production code paths.

### Phase 7b — Code Validation 1 — Static Analysis Gate

- **Tool**: SonarQube with **Static Analysis Gate** profile (no coverage threshold).
- **What it checks**: Code smells, security vulnerabilities, complexity violations, duplication.
- **Rules**:
  - Fix all blocker and critical issues before advancing.
  - 3-attempt retry limit. On persistent failure, stop and escalate.
- **Exit criteria**: SonarQube Static Analysis Gate passes with zero blocker/critical issues.

### Phase 8 — Testing Build Mode (`.ai/prompts/test-build-mode.md`)

- **Role**: Spec-driven, post-implementation test generation (Unit/API and UI/E2E), selected with `Phase`.
- **Input**: Frozen FDS (`fds.md`), Behavior Spec (`behavior.md`), integrated source code.
- **Rules**:
  - Primary context is the specification, not the implementation.
  - Generates unit, integration, and E2E tests that validate behavior against the FDS.
  - **MUST NOT modify production source code** unless a genuine defect is found.
  - Defect classification required: `defect` (triage via `.ai/prompts/diagnosis-mode.md` and return to Backend/Frontend/Integration build) vs `bad-test` (rewrite the test).
  - Human escalation if classification is uncertain.
  - `Phase = Both` rolls up a Unit/API Test subagent and a UI/E2E Test subagent from a single orchestrating session, same subagent pattern as Phase 1 and Phase 5; `Phase = UnitAPI` or `Phase = UIE2E` runs one scope individually when session tokens are low.
- **Exit criteria**: All tests pass. Coverage meets the threshold declared in `fds.md` frontmatter.

### Phase 8b — Diagnosis & Fix Loop (`.ai/prompts/diagnosis-mode.md`)

- **Role**: Runs when Phase 8 reports failures the test agents could not resolve within their own bounded retries. Read-only classifier: independently classifies each failure into exactly one of six categories (Backend defect, Frontend defect, Integration-wiring defect, Bad test, Contract mismatch, FDS ambiguity) and routes it to exactly one owner. Never edits code itself, and never self-approves — findings routed to the same owner are batched into one Fix Mode session.
- **Output**: `v<version>/diagnosis.md` — every finding's classification, routing target, and a concrete Suggested Next Step, plus a Batching Summary grouping findings by owner.
- **Exit criteria**: Every finding routed and its fix committed; Integration (Phase 7) and Test Build Mode (Phase 8) are re-run afterward before proceeding to Phase 8c.

### Phase 8c — Code Validation 2 — Full Quality Gate

- **Tool**: SonarQube with **Full Quality Gate** profile (static analysis + coverage thresholds).
- **What it checks**: Everything in Code Validation 1 plus line/branch coverage.
- **Rules**:
  - Coverage threshold: as declared in `fds.md` frontmatter (default: >80% new code line coverage).
  - 3-attempt retry limit. On persistent failure, stop and escalate.
- **Exit criteria**: SonarQube Full Quality Gate passes.

### Phase 9 — Validation Report (`.ai/prompts/validation-prompt.md`)

- **Role**: Final compliance matrix confirming every acceptance criterion is satisfied.
- **Output**: `features/<id>/validation-report.md`
- **Persistence**: Ephemeral by default. Mark as persistent in `fds.md` frontmatter for compliance-relevant features.
- **Exit criteria**: All acceptance criteria checked. Report complete.

---

## 3. Rollback Decision Tree

If any phase fails and cannot be resolved in-place within its retry limit:

```
Test failure (Phase 8, Test Build Mode)
  ├─ Defect in production code?        → Diagnosis Mode (Phase 8b) routes to Backend/Frontend (Phase 5) or Integration (Phase 7)
  ├─ Contract mismatch discovered?     → Diagnosis Mode routes to the Developer Approval Gate (Phase 4); renegotiate
  │                                       and re-approve v<version>/contract.md, then re-run Build (Phase 5)
  ├─ FDS ambiguity surfaced?           → unfreeze specs; classify per §4 below (Clarification/Extension/Contradiction);
  │                                       Extension or Contradiction restarts from Phase 1
  └─ Bad test (not a defect)?          → rewrite test; stay in Phase 8

SonarQube Code Validation 1 (Phase 7b) or 2 (Phase 8c) failure
  ├─ Code smell / complexity?          → fix in-place (stay in current phase)
  └─ Architectural violation?          → return to Phase 5 (Build)

Build failure (Phase 5)
  ├─ Contract incompatible?            → attempt in-place resolution first
  └─ Fundamental contract breach?      → stop; escalate to the Developer Approval Gate (Phase 4) — neither side may
                                          edit the frozen contract itself

Plan Review CHANGES REQUIRED (Phase 3)
  ├─ Specs sound, a real choice exists? → developer records the decision in v<version>/directives.md; revise
  │                                        plan.md/contract.md in place (Phase 2, or the affected fragment
  │                                        in Phase 1 first); re-review (Phase 3)
  └─ Specs themselves are ambiguous?    → reviewer stops and escalates; developer edits fds.md/behavior.md;
                                           re-draft the affected fragment(s) (Phase 1)
```

---

## 4. Change Classification (Frozen Spec Amendments)

When a gap or conflict is discovered in the frozen specs during implementation:

| Class             | Definition                                                 | Response                                                  |
| :---------------- | :--------------------------------------------------------- | :-------------------------------------------------------- |
| **Clarification** | Gap always implied by the FDS, just not written explicitly | Document an addendum in-place; no restart required        |
| **Extension**     | New requirement not implied by the FDS                     | New FDS version; restart from Phase 1                     |
| **Contradiction** | Implementation reveals the FDS is internally inconsistent  | New FDS version; restart from Phase 1; stakeholder review |

---

## 5. Feature Classification Rubric

Before choosing the workflow depth for a feature, classify it:

| Axis                          | Score 0                          | Score 1                       | Score 2                                  |
| :---------------------------- | :------------------------------- | :---------------------------- | :--------------------------------------- |
| **Specification stability**   | Requirements expected to change  | Requirements mostly stable    | Fully locked and approved                |
| **UI/API surface complexity** | Single component, no API changes | Multi-component, existing API | New multi-step UI with new API contracts |
| **Team/agent separation**     | Single developer or agent        | Two, loosely coordinated      | Dedicated frontend + backend roles       |

- **Score 0–2**: Use simplified two-mode flow (inline tests, no staged phases).
- **Score 3–4**: Use the full Multi-Agent pipeline (Phases 0–9, including Plan Fragments → Synthesizer so a `contract.md` exists for Build). Phases 1, 5 and 8 may run each layer/scope individually instead of `Phase = Both`.
- **Score 5–6**: Use full Staged Dual-Validation flow (or full Multi-Agent pipeline).

---

## 6. Living Specification Standards (`features/<feature-id>/`)

```
features/<feature-id>/
├── fds.md                    # Feature Design Specification (YAML frontmatter + requirements)
├── behavior.md               # Interaction & Behavioral Specification
├── plans/                    # One directory per plan version (see "Plan Artifact Layout" below)
│   ├── activity-log.md       # Audit trail for multi-agent execution (shared across versions)
│   └── v1.0.0/
│       ├── plan.md           # Implementation Plan (generated in Plan Mode; frozen after approval)
│       ├── contract.md       # API Contract specification (frozen after approval)
│       ├── review.md         # Latest Plan Review report
│       ├── reviews/          # Archived earlier reviews (r1.md, r2.md, ...)
│       ├── fragments/        # frontend.md, backend.md (synthesis inputs)
│       ├── directives.md     # Developer decisions for a revision run, if any
│       ├── defects-unit-api.md / defects-ui-e2e.md   # Test-agent defect files, if any
│       └── diagnosis.md      # Diagnosis Mode report, if any
├── validation-report.md      # Validation Report (generated after Code Validation 2)
└── visuals/                  # Visual design specs (figma.md, screenshots)
```

### Plan Artifact Layout

All artifacts of one plan version live together in `features/<feature-id>/plans/v<version>/`. `<version>` is the `version` declared in `fds.md` frontmatter.

| Artifact                                  | Path (inside `plans/`)                                                | Written by                                                          |
| :---------------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------ |
| Implementation plan                       | `v<version>/plan.md`                                                  | Plan Synthesizer / Plan Mode                                        |
| API contract                              | `v<version>/contract.md`                                              | Plan Synthesizer                                                    |
| Latest plan review                        | `v<version>/review.md`                                                | Plan Review                                                         |
| Earlier plan reviews                      | `v<version>/reviews/r<N>.md`                                          | Plan Review (archiving step)                                        |
| Revision directives (developer decisions) | `v<version>/directives.md`                                            | Developer, optionally drafted from the review's Suggested Next Step |
| Frontend / backend fragments              | `v<version>/fragments/frontend.md`, `v<version>/fragments/backend.md` | Plan Fragments                                                      |
| Test defect files                         | `v<version>/defects-unit-api.md`, `v<version>/defects-ui-e2e.md`      | Test Build Mode                                                     |
| Diagnosis report                          | `v<version>/diagnosis.md`                                             | Diagnosis Mode                                                      |
| Audit trail                               | `activity-log.md` (one per feature, not per version)                  | every planning phase                                                |

Rules:

1. **One directory per version.** A new FDS version creates a new sibling `v<new-version>/` directory. Older version directories are immutable history once a newer one exists.
2. **Fixed filenames.** Versioned plan artifacts are never written directly under `plans/`, and the version is never repeated in a filename (no `plan-v1.0.0.md`). Agents create `v<version>/` and its subdirectories when absent.
3. **Revisions stay in place.** When Plan Review returns `CHANGES REQUIRED`, the unfrozen `plan.md` and `contract.md` are revised in place in the same version directory (via the Plan Synthesizer or by editing the fragments and re-synthesizing). The version is not bumped; a new version directory is only for a new FDS version. Developer decisions that steer a revision are written to `v<version>/directives.md` in the repository (never a scratchpad), and the agents read it; starred decisions also go into the plan's Decision Log.
4. **Review archiving.** `review.md` is always the latest review. Before writing a new review, Plan Review moves the existing `review.md` to `reviews/r<N>.md`, where `N` is 1 plus the number of files already in `reviews/`. Reviewers never read `reviews/`, so every review is independent of earlier ones.
5. **Superseded fragments.** Once `plan.md` exists, fragments are history, not inputs to later phases. If `plan.md` or `contract.md` is edited afterward without regenerating from the fragments, both fragments get a banner as their first line after the title: `> **SUPERSEDED.** Stale after revision <N>. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md`and`../contract.md`.`
6. **Audit trail.** `activity-log.md` is append-only. Each entry's `output:` path is relative to `plans/` (for example `v1.0.0/plan.md`). Existing entries are never rewritten, even when the layout changes; a legend line is appended instead.
7. **Freeze.** At the Developer Approval Gate, `v<version>/plan.md` and `v<version>/contract.md` are frozen (see §4 for amendments).

### FDS Frontmatter Requirements

All `fds.md` files MUST declare:

- `id`: Feature identifier (kebab-case)
- `title`: Human-readable feature name
- `status`: `active` | `draft` | `archived`
- `version`: SemVer string (e.g., `1.0.0`)
- `owner`: Team or feature owner
- `last_updated`: YYYY-MM-DD date
- `coverage_target`: Minimum line coverage % (e.g., `80`) — used by Phase 8c
- `compliance_relevant`: `true` | `false` — determines if Validation Report is persistent
- `dependencies`: List of dependent features with minimum versions
- `changelog`: List of version history entries

---

## 7. SonarQube Quality Gate Profiles

Two named profiles must be configured before first use:

| Profile                  | Used In                      | Coverage Threshold                                 | Other Rules                                                 |
| :----------------------- | :--------------------------- | :------------------------------------------------- | :---------------------------------------------------------- |
| **Static Analysis Gate** | Code Validation 1 (Phase 7b) | Disabled (zero tests exist)                        | Bugs, vulnerabilities, code smells, complexity, duplication |
| **Full Quality Gate**    | Code Validation 2 (Phase 8c) | Enabled (per `coverage_target` in FDS frontmatter) | All Static Analysis Gate rules + coverage                   |

---

## 8. Bounded Retry Policy

All self-correction loops are bounded at **3 attempts** per task or gate. A full-suite fix (running the entire project linter/type-checker/test suite after all of a phase's individual tasks are done, per Phase 5/7/8's "After all phase items..." step) gets a wider **5-attempt** budget, since it may need to reconcile several tasks' worth of changes at once. Beyond either limit, stop and escalate. Do not continue retrying — LLM output oscillates and degrades beyond these limits.
