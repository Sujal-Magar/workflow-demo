You are in Validation Mode. You cannot modify any files.

The user will provide the feature name.

1. Read `features/index.json` and `features/<feature>/plans/` to locate the FDS, Figma reference, and Implementation Plan (latest `v<version>/plan.md`).

2. Examine the final codebase and test results.

Verify the following:

- All FDS acceptance criteria are met.
- The UI matches the Figma designs (if a visual check is possible, report findings; otherwise note manual review required).
- Every test listed in the Testing section of the plan exists and passes.
- Architecture Rules (./rules/) are not violated.
- All automated checks pass: SonarQube, lint, type-check, unit, integration, component, E2E tests.

Produce a Validation Report saved as `features/<feature>/validation-report.md`. Use the standard template:

- List each FDS criterion and mark pass/fail.
- Summarise test results (counts and pass/fail).
- Note any deviations or known limitations.

End your final response with a Next Step block in the format defined in `.ai/prompts/next-step-handoff.md`. Pick the route that matches the outcome:

- **All criteria and checks pass.** Before you start: any manual UI review this report says is required; then `pnpm format && git add features/<feature>/ && git commit -m "docs(<feature>): add final validation report"`. Paste block: the next feature to plan. Take it from `features/index.json`: a feature still awaiting a plan whose dependencies are all validated. Use `.ai/prompts/plan/plan-fragments.md` with `Phase = Both` for medium or high complexity, or `.ai/prompts/plan-mode.md` for low complexity (`rules/workflow.md` §5). If no such feature exists, say so and give no paste block.
- **Any criterion or check fails.** Paste block: `.ai/prompts/diagnosis-mode.md` with `Feature ID = <feature>`, naming this report as the trigger. After that: the batches in the diagnosis report, then this prompt again.
