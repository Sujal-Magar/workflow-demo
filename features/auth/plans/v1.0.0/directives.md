# Directives: auth v1.0.0

Entries are grouped by review round. Finding IDs (B-1, B-2, ...) restart in each review, so always cite the round with the ID.

## Revision 1 (from reviews/r1.md), already applied

Do not re-apply these. They are kept as the audit trail for plan revision 1.

### B-2 Owner of setup task S-01

Options considered: A) developer runs S-01 by hand before Phase 5;
B) dedicated one-off "Setup" agent session with explicit
permission for backend/package.json, frontend/package.json,
pnpm-workspace.yaml, pnpm-lock.yaml, .env.example
Decision: A — the developer runs S-01 manually before Phase 5 and commits it alone.
S-01 must list the exact commands (pnpm add per workspace, the
pnpm-workspace.yaml allowBuilds edit, the .env.example lines, pnpm install,
the argon2 load check, and the commit message). Remove "Build orchestrator"
and "first individual Build run" as owners.
Apply to: plan.md D-01, §2 Execution Order step 0, §3 S-01
Record as a starred (★) decision in the plan's Decision Log: yes

## Revision 2 (from review.md, 2026-09-30 11:48), to apply

### B-1 Coverage of the shared contract package (packages/contracts/src/auth/**)

Options considered: A) tests and lcov in packages/contracts (widen the Unit/API test scope);
B) keep tests in backend/, coverage.allowExternal + include;
C) exclude packages/contracts from Sonar coverage
Decision: A
Details: The rule-set tests (T-UA-01) live in packages/contracts/src/**/*.test.ts and are
run by the package's own vitest.config.ts. The Unit/API Test agent owns them
(.ai/prompts/test-build-mode.md now allows test files and vitest.config.ts under
packages/contracts/). That config sets coverage.reporter to include "lcov" and
"text", producing packages/contracts/coverage/lcov.info as
sonar-project.properties expects. D-17 is removed.
Apply to: plan.md D-17, §2 path ownership (Unit/API row), §8 test harness, T-UA-01
Record as a starred (★) decision in the plan's Decision Log: yes

## Revision 3 (from review.md, 2026-09-30 12:01), to apply

This is the fourth plan draft reviewed. The developer authorizes this revision beyond the
three-attempt bound in rules/workflow.md §8.

### B-1 Fetcher ↔ session layer interface (import cycle api-client → session-refresh → auth-api → api-client)

Options considered: A) api-client exports registerSessionHandlers({ refreshSession, onSessionExpired });
AuthProvider registers on mount; api-client imports nothing from session/
B) single-flight refresh moves into lib/api-client.ts; session layer subscribes
via onSessionExpired(listener)
C) fetcher returns 401 unchanged; QueryCache/MutationCache onError refresh + retry
Decision: A
Details: - lib/api-client.ts exports registerSessionHandlers({ refreshSession, onSessionExpired })
and imports nothing from features/auth/session/ or features/auth/api/. The only import
direction is session/ → api/ → lib/api-client.ts. - FE-10 keeps the single-flight refresh in session-refresh.ts and exposes an
expireSession() (clearSession + router.replace('/auth')), so Integration only has to
register the two functions. - INT-02 adds registerSessionHandlers and the registration call in AuthProvider (on mount,
unregistered on unmount). A protected 401 UNAUTHENTICATED calls the registered
refreshSession, retries once, and on refresh failure or a second 401 calls
onSessionExpired. - Before any handlers are registered, the fetcher returns the 401 unchanged. - Tests: T-UI-09 uses registered fakes and adds "no handlers registered → 401 returned
unchanged, no refresh"; T-UI-08 adds "provider registers handlers on mount".
Apply to: plan.md FE-10, INT-02, INT-03, T-UI-08, T-UI-09, §9.1
Record as a starred (★) decision in the plan's Decision Log: yes

### B-2 @ts-rest/core for the frontend (obvious fix, follows D-01)

Decision: Install it in S-01, not in Integration. S-01 step 4 becomes:
pnpm --filter @workflow-demo/frontend add @react-oauth/google @ts-rest/core@~3.52.0
(@ts-rest/react-query 3.52.1 requires @ts-rest/core ~3.52.0 as a peer and does not
re-export tsRestFetchApi/ApiFetcherArgs.) Remove D-20 and the conditional in INT-02's
Files line. Drop "INT-02 (D-20)" from the §9.1 "FDS §2 Approved libraries" row.
Apply to: plan.md S-01, D-20, INT-02, §9.1
Record as a starred (★) decision in the plan's Decision Log: no

### B-3 Untested files vs the 95% coverage gate

Options considered: A) test every file (env modules, providers, layouts, pages, db client file path;
refactor backend index.ts to be importable)
B) test env.ts (backend and frontend), providers, pages and layouts; exclude only
thin process/framework entry points via sonar.coverage.exclusions (developer
adds in S-01), mirrored in coverage.exclude in TH-01/TH-02
C) scope the 95% target to auth code only
Decision: B
Details: - New Unit/API tests: - backend/src/config/env.ts: missing JWT_SECRET, or one under 32 characters, gives a
readable error. GOOGLE_CLIENT_ID is required only when NODE_ENV=production, and an
empty value counts as unset. Defaults for FRONTEND_ORIGIN, DATABASE_PATH and PORT. - backend/src/db/client.ts on a temporary file path: creates the missing parent
directory, and enables foreign keys and WAL. - db/migrate.ts must export the migration function that both index.ts and the test
harness call, so it is covered and is NOT excluded. - New UI tests: - frontend/src/lib/env.ts: API base URL fallback; Google client ID optional/empty. - Render tests for app/providers.tsx (provider order), app/page.tsx,
app/auth/page.tsx and app/reset-password/page.tsx (Suspense boundary + query
params), app/(protected)/layout.tsx and app/(protected)/dashboard/page.tsx. - Coverage exclusions (exactly these two files, no rules in them):
backend/src/index.ts, frontend/src/app/layout.tsx. - S-01 gains a sixth file: the developer adds
sonar.coverage.exclusions=backend/src/index.ts,frontend/src/app/layout.tsx
to sonar-project.properties and commits it with the other S-01 files. - TH-01 adds src/index.ts to coverage.exclude in backend/vitest.config.ts. - TH-02 adds src/app/layout.tsx to coverage.exclude in frontend/vitest.config.ts.
Apply to: plan.md S-01, BE-01, BE-02, FE-01, FE-11, TH-01, TH-02, §8.1 (new T-UA row or extend
T-UA-02/T-UA-03), §8.2 (new T-UI row), §9.1, §10
Record as a starred (★) decision in the plan's Decision Log: yes

### A-6 Other protected routes (/transactions, /budget, /goals, /reports, /profile)

Decision: Star D-13, so the developer confirms at the Approval Gate that those redirects are
verified only once their owning features add pages to the (protected) group.
Apply to: plan.md D-13, §10 starred list
Record as a starred (★) decision in the plan's Decision Log: yes

### Advisory items to apply (from the same review)

- A-1: FE-06 card about 800 × 600 CSS px; FE-02 inputs about 320 × 48, buttons about 160 × 40.
  The visuals are 2× captures of a 1440 × 956 viewport.
- A-2: FE-06 sets `inert` on the hidden form through a ref (element.inert = isHidden), because
  @types/react 18 has no `inert` prop.
- A-3: BE-03: the typed contract carries the full /api/v1/auth path in every route. BE-14: the
  auth routes are not mounted under an extra prefix. INT-02's base URL stays origin-only.
- A-4: FE-04 maps a VALIDATION_ERROR whose fieldErrors has no key for a field on the form
  (including an empty map) to "unexpected"; add that case to T-UI-18.
- A-5: T-UI-06 also tests closing by outside click and by the close control.
- A-7: FE-14 states that the current-user query refetches on mount despite initial data
  (staleTime 0), since T-UI-14 depends on that /me request.
- A-8: INT-07 sets GOOGLE_CLIENT_ID explicitly empty in the backend webServer env; BE-01 treats
  empty as unset (covered by B-3's env.ts test).
- A-9: Give the §8.3 e2e/smoke.spec.ts update a task ID (T-UI-19), owned by the UI/E2E agent and
  traced to REQ-AUTH-07 (root route).
- A-10: Not a plan change. The developer commits .ai/prompts/test-build-mode.md before the
  Approval Gate.

## Revision 4 (from review.md, 2026-09-30 12:24), applied by the developer

This is the fifth plan draft reviewed. The developer applied this revision directly and waived
a further Plan Review: the findings have narrowed to one small, local decision, and the
three-attempt bound in rules/workflow.md §8 has already been exceeded. The plan proceeds to the
Developer Approval Gate without a PASS verdict on this basis.

### B-1 CHECK constraint vs locked drizzle-kit 0.24.2

Options considered: A) keep the DB-level CHECK and add it by hand to the generated users migration
B) drop the DB-level CHECK; the service enforces the invariant
C) upgrade drizzle-orm (>= 0.36) and drizzle-kit (>= 0.27)
Decision: A
Apply to: BE-02 (T-UA-03 unchanged)
Record as a starred (★) decision in the plan's Decision Log: no

### Advisory items

Not applied (A-1 to A-6 of review.md). They may be handled during Build or a later revision.

## Post-Validation SonarQube Triage (developer, 2026-10-01), applied

Not tied to a plan review round. The 2026-10-01 10:12 validation-report.md (§2.1, §6) found that two
SonarQube findings were marked false-positive on the server (2026-10-01 04:12-04:15 UTC, right after
commit 03e700b) rather than fixed in code, with no record of the decision. The developer confirmed
both dismissals are intentional. This entry is that record.

### SQ-02 — typescript:S3735 (CRITICAL), frontend/src/components/ui/icon-input.tsx:40

Finding: `void box.offsetWidth;` is flagged for "unnecessary" use of the void operator.
Decision: False positive, confirmed. The statement is not unnecessary — reading `offsetWidth`
forces a synchronous layout reflow so the shake animation restarts on repeated validation errors on
the same field. `void` only discards the read value to satisfy `no-unused-expressions`; removing the
line would remove the reflow and break the restart behavior. The rule does not have a side-effect
exception for this pattern.
Apply to: no code change. Keep the server-side false-positive marking on this issue.

### SQ-03 — typescript:S2068 (vulnerability) + typescript:S7719 ×2, backend/src/test-support/auth-test-harness.ts:28-29,40,44

Finding: `STRONG_PASSWORD`/`OTHER_STRONG_PASSWORD` string literals flagged as hard-coded passwords.
Decision: False positive, confirmed. These are fixture values for integration tests, not credentials
for any real account; the file is under `backend/src/test-support/` and is imported only by
`*.test.ts` files. The underlying scoping cause (test-support files fall under `sonar.sources` but
not `sonar.test.inclusions`) is accepted as-is for this version rather than changed, so the same
false-positive marking will be needed again if new files are added under `test-support/`.
Apply to: no code change this version. A future revision may fix `sonar.test.inclusions` in
`sonar-project.properties` to cover `**/test-support/**` and `frontend/src/test/**` so this stops
recurring.
