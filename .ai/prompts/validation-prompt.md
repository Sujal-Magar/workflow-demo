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
