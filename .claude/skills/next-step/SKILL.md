---
name: next-step
description: Use when the user asks what's next in this project's AI workflow, wants to continue/advance a feature, asks "am I ready for the next step", or asks to run/start the next phase for any feature.
---

# Next Step

## Overview

This project (workflow-demo) runs the Staged Dual-Validation Workflow defined in `CLAUDE.md` and `rules/workflow.md`. Every phase prompt ends its response with a `## Next Step` block (format in `.ai/prompts/next-step-handoff.md`) naming the next phase and a paste-ready prompt for a new session. This skill finds that state from the repo itself instead of requiring the user to track it by hand or re-paste the last block.

## How to determine current state

1. Read `features/index.json` for the feature list, `dependencies`, and declared `status`. Don't trust `status` alone — it can lag.
2. For the target feature (the one the user named, or every feature if they didn't), inspect `features/<id>/plans/activity-log.md` and `features/<id>/plans/v<version>/` for what actually exists: fragments → `plan.md`/`contract.md` → `review.md` verdict → build activity-log entries → test activity-log entries → `diagnosis.md` → `validation-report.md` verdict. The activity log is the source of truth for what ran and whether it passed, not what was merely requested.
3. A feature is blocked on planning until every entry in its `dependencies` array has a PASS (or accepted-with-known-limitations) `validation-report.md`.
4. If a gate/loop already failed N times for this feature, check `rules/workflow.md` §8's retry bound (3 attempts per gate, 5 for a full-suite fix) before offering another automatic attempt — if the bound is reached, say so and ask for explicit authorization instead of proposing a routine retry.

## What to do with that state

- If the very next action can be done directly in this session (you already have the context loaded, e.g. just re-running validation after a developer fix), do it — follow the exact prompt file for that phase.
- If the next action needs a fresh session (a different phase's system prompt per CLAUDE.md's "How to Invoke AI Workflow Modes"), produce the exact paste-ready block in the format from `.ai/prompts/next-step-handoff.md`: real feature ID, real phase, no template placeholders, any human steps listed first under "Before you start."
- If multiple features are ready to advance (e.g. independent features with satisfied dependencies), say so and let the user pick, rather than silently choosing one.

## Quick reference: phase → prompt file

| Phase                   | Prompt file                                                                        |
| :---------------------- | :--------------------------------------------------------------------------------- |
| 1 — Plan Fragments      | `.ai/prompts/plan/plan-fragments.md`                                               |
| 2 — Plan Synthesizer    | `.ai/prompts/plan/plan-synthesizer.md`                                             |
| 3 — Plan Review         | `.ai/prompts/plan/plan-review.md`                                                  |
| 5 / 7 — Build Mode      | `.ai/prompts/build-mode.md`                                                        |
| 8 — Test Build Mode     | `.ai/prompts/test-build-mode.md`                                                   |
| 8b — Diagnosis Mode     | `.ai/prompts/diagnosis-mode.md`                                                    |
| 9 — Validation          | `.ai/prompts/validation-prompt.md`                                                 |
| Low-complexity baseline | `.ai/prompts/plan-mode.md` (plan), `.ai/prompts/build-mode.md` (build, sequential) |

Full phase table, complexity scoring and retry rules: `CLAUDE.md`, `rules/workflow.md` §§2, 5, 8.

## Common mistakes

- Trusting `features/index.json`'s `status` field instead of the activity log — it is not updated automatically.
- Proposing a routine retry on a gate/loop that already hit its `rules/workflow.md` §8 bound.
- Routing an infrastructure/config gap (e.g. a missing server-side tool profile) through Diagnosis Mode, which only classifies code defects.
