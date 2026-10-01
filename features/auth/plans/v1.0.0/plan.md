# Implementation Plan: auth (v1.0.0)

- **Feature:** `auth`, Authentication and Identity
- **FDS version:** 1.0.0 (`features/auth/fds.md`, changelog entry 1.0.0 dated 2026-09-22)
- **Scenario:** New Standalone Feature. `dependencies: []` and the changelog has a single entry, so this plan covers the whole FDS. There is no cross-feature foundation phase.
- **Complexity:** spec stability 2 + UI/API surface 2 + team/agent separation 2 = **6**, so the full multi-agent pipeline applies (`rules/workflow.md` §5).
- **Coverage target:** 95% (FDS frontmatter). `compliance_relevant: true`, so the Validation Report is persistent.
- **Sources synthesized:** `fragments/frontend.md`, `fragments/backend.md`, `fds.md`, `behavior.md`, `visuals/auth-signin-page.png`, `visuals/auth-signup-page.png`, `rules/*`, `features/index.json`.
- **Revision 1 (2026-09-30):** revised in place after Plan Review (`review.md`) returned CHANGES REQUIRED, applying [`directives.md`](directives.md). The fragments were not regenerated. Changed: B-1 (D-12, FE-13, T-UI-07), B-2 (D-01, §2 step 0, S-01), A-1 (BE-10, BE-11, T-UA-06, T-UA-07), A-2 (FE-07, FE-08, FE-12, FE-13, T-UI-13), A-3 (FE-09) and A-4 (new T-UI-18, referenced in §2 and §9.1). `contract.md` is unchanged.
- **Revision 2 (2026-09-30):** revised in place after the second Plan Review (`review.md`, 11:48) returned CHANGES REQUIRED, applying only the "Revision 2" section of [`directives.md`](directives.md). The fragments were not regenerated. Changed: B-1 (D-17 removed and replaced by the starred D-22; §2 Unit/API row; §8.1 heading, harness and T-UA-01), B-2 (new harness tasks TH-01 in §8.1 and TH-02 in §8.2 set the LCOV coverage reporters; §2 Tasks and UI/E2E rows; §8 intro), plus the matching §9.1 row and the §10 starred-decision list. `contract.md` is unchanged.
- **Revision 3 (2026-09-30):** revised in place after the third Plan Review (`review.md`, 12:01) returned CHANGES REQUIRED, applying only the "Revision 3" section of [`directives.md`](directives.md). The developer authorized this revision beyond the three-attempt bound. The fragments were not regenerated. Changed: B-1 (new starred D-23; FE-10, INT-02, INT-03, T-UI-08, T-UI-09; the access-token store moves to `lib/`, so the §5.1 layout table changes too), B-2 (D-20 removed; S-01 step 4 adds `@ts-rest/core@~3.52.0`; INT-02 Files line), B-3 (new starred D-24; S-01 gains `sonar-project.properties` as a sixth file, reflected in D-01 and the §2 step 0 row; BE-01, BE-02, BE-14, FE-01, FE-11, TH-01, TH-02; new T-UA-11 and T-UI-20, so the §2 Unit/API and UI/E2E rows change; §8 intro and harness), A-6 (D-13 starred), advisory A-1 (FE-02, FE-06), A-2 (FE-06), A-3 (BE-03, BE-14, INT-02), A-4 (FE-04, T-UI-18), A-5 (T-UI-06), A-7 (FE-14), A-8 (BE-01, INT-07) and A-9 (§8.3 smoke test becomes T-UI-19), plus the matching §9.1 rows and the §10 starred-decision list. `contract.md` is unchanged: B-1 keeps the contract §7 client retry rule as written, and A-3 concerns only the typed package.
- **Revision 4 (2026-09-30):** applied by the developer after the fourth Plan Review (`review.md`, 12:24) returned CHANGES REQUIRED, per the "Revision 4" section of [`directives.md`](directives.md). Changed: B-1 option A (BE-02 adds the `users` CHECK constraint to the generated migration by hand, because the locked drizzle-kit 0.24.2 does not generate it). T-UA-03 is unchanged. The developer waived a further re-review; advisory findings A-1 to A-6 were not applied. `contract.md` is unchanged.
- **API Contract:** [`contract.md`](contract.md) in this directory. It is the only definition of routes, bodies, statuses, error codes, the refresh cookie and the shared validation rule sets. This plan refers to it and does not repeat it.

**How to read task entries.** Each task has an ID, a `layer` (which build session owns it), the files it creates or changes, what "done" means, and its spec trace. Paths are relative to the repository root. Build agents implement tasks in ID order within their layer unless a task says otherwise.

---

## 1. Decision Log

★ = the developer should confirm this explicitly at the Approval Gate. It is a real choice, not something the specs dictate. Unstarred entries follow directly from the specs or rules and are recorded so that Build does not have to re-decide them.

| ID     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Basis                                                                                                                                                                                               |
| :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 ★ | **The developer runs setup task S-01 by hand, once, before Phase 5, and commits it on its own.** No agent session owns S-01. It installs every approved dependency, including the frontend's `@ts-rest/core` (Revision 3 B-2; the former D-20 is removed), and makes the only root-file edits the plan needs (`backend/package.json`, `frontend/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.env.example`, `sonar-project.properties`), using the exact commands in S-01. Frontend and Backend Build then never touch root files, the other layer's `package.json` or the lockfile, so their path boundaries (CLAUDE.md, `.ai/prompts/build-mode.md`) stay strict and two parallel `pnpm add` runs cannot race on one lockfile. Phase 5 starts only after the S-01 commit exists; a Build agent that finds a dependency missing stops and escalates instead of installing it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | FDS §2 (approves the libraries and argon2's build script); CLAUDE.md path boundaries; `.ai/prompts/build-mode.md`; `directives.md` B-2 (option A); backend fragment Open Q-1                        |
| D-02 ★ | **"Google sign-in is unavailable." is shown when the user clicks the Google control**, not on page load. When Google is unavailable, a same-size fallback icon button takes the place of the Google button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | behavior §5 step 2 places the toast under "User clicks it"; REQ-AUTH-03                                                                                                                             |
| D-03 ★ | **Small screens (below the `md` breakpoint):** the brand panel stacks above the active form, with no sliding animation, and only the active form is shown. All copy is unchanged. Confirmed or adjusted at Phase 6 UI Review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `rules/tech-stack.md` "Responsive" principle; the visuals only show desktop                                                                                                                         |
| D-04   | The FinTrack logo is an inline SVG/text wordmark (arrow glyph plus the tagline "Track smarter. Save better.") because no logo file is supplied. Fonts are Inter (body, overlay headings) and Poppins (form titles), loaded with `next/font/google`, which ships with `next`, so no new dependency. Both are checked at Phase 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | visuals; `rules/tech-stack.md` (no new libraries)                                                                                                                                                   |
| D-05 ★ | **The shared validation rules trim `name` and `email` before checking,** so `"   "` gives "Name is required." and trimmed values are stored. Passwords are never trimmed. Email lowercasing happens in the service, not in the shared rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | FDS §5 ("empty", "normalized to lowercase"); contract §5 and C5                                                                                                                                     |
| D-06   | A missing or empty `token` on `/google` or `/reset-password` returns `400 VALIDATION_ERROR` with `fieldErrors.token = "Token is required."`. This message is API-only; no UI path can produce it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | FDS §6 (body validation failure → `VALIDATION_ERROR`); contract C1                                                                                                                                  |
| D-07   | Unexpected failures return `500 INTERNAL_ERROR` and unmatched routes return `404 NOT_FOUND`, both using the FDS error shape. Every error code has a fixed `message` (contract §3) that the UI never displays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | FDS §6 error shape; contract C2, C3                                                                                                                                                                 |
| D-08   | `GOOGLE_CLIENT_ID` is required when `NODE_ENV=production`. Otherwise it is optional; if it is unset, `/google` always returns `401 INVALID_GOOGLE_TOKEN` and never calls the verifier without an audience.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | FDS REQ-AUTH-03 (audience check); contract C6                                                                                                                                                       |
| D-09   | The access token is renewed 60 seconds before `expiresIn` elapses (never scheduled below 0 seconds).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | REQ-AUTH-06 "before it expires"; behavior §7 "shortly before"                                                                                                                                       |
| D-10 ★ | **The valid-reset-token journey is not tested end to end in the browser.** The raw token is only printed to the backend console (FDS REQ-AUTH-05), which Playwright cannot read, and adding a test-only way to fetch it would be a new requirement. E2E covers the missing-token and invalid-token states. The valid path (set password, single use, 30-minute expiry, all sessions ended, sign in with the new password) is covered by backend API tests with a capturing mailer and by frontend component tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | FDS REQ-AUTH-05, §7 AC12; frontend Open Q-10                                                                                                                                                        |
| D-11 ★ | **E2E runs with Google unconfigured on both sides** (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` unset). E2E asserts the Google control is present on both panels and that clicking it shows "Google sign-in is unavailable." The Google popup cannot be automated. The sign-in, link and create paths are covered by backend API tests with a fake verifier and frontend component tests with a mocked Google component.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | FDS REQ-AUTH-03, §7 AC8–9                                                                                                                                                                           |
| D-12   | `/reset-password` has no guard. It is neither a protected route nor `/auth` in REQ-AUTH-07, and it works whether or not the visitor is signed in. **On reset success, a signed-in visitor's local session is cleared** (FE-10 `clearSession()`, called by FE-13) before the redirect to `/auth?mode=signin`, so the guest-only guard shows the sign-in form instead of bouncing to `/dashboard`. The server has already revoked every refresh token, so `logout()` is not called.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | REQ-AUTH-07 (lists the guarded routes); REQ-AUTH-05 Step 2 ("not signed in automatically"); behavior §6 step 3, §8                                                                                  |
| D-13 ★ | **The protected guard lives in the `(protected)` route-group layout, and auth ships only `/dashboard` (a placeholder).** The features that own `/transactions`, `/budget`, `/goals`, `/reports` and `/profile` must put their pages inside this group; their redirect E2E tests arrive with those pages. Until then those URLs return 404, so the developer accepts at the Approval Gate that the REQ-AUTH-07 redirects for these five routes are verified only once their owning features add pages to the `(protected)` group, not by this feature's Phase 9 Validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | REQ-AUTH-07; `directives.md` Revision 3 A-6                                                                                                                                                         |
| D-14   | If creating a Google account hits the email UNIQUE constraint (a concurrent sign-up won the race), the service re-runs resolution once from the link step instead of failing with 500.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | REQ-AUTH-03 resolution order; backend Open Q-6                                                                                                                                                      |
| D-15   | No maximum lengths for `name`, `email` or `password` beyond the 100 kB request-body limit, so no validation messages are invented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | FDS §5 defines none                                                                                                                                                                                 |
| D-16   | Login runs an argon2 verification against a fixed dummy hash when the account is unknown or has no password, so response time does not reveal which case happened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REQ-AUTH-02, §7 "never reveals"                                                                                                                                                                     |
| D-18   | Toasts and icons are built in-house (small provider plus inline SVG). No toast or icon library is approved. Component tests use `fireEvent` because `@testing-library/user-event` is not approved. Component tests mock network access with `vi.mock`; MSW is not approved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `rules/tech-stack.md`                                                                                                                                                                               |
| D-19   | The frontend reads the API origin from `NEXT_PUBLIC_API_BASE_URL`, falling back to `http://localhost:4000` in development.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | FDS §6 base path; frontend Open Q-3                                                                                                                                                                 |
| D-21   | The API origin and the frontend origin must be same-site for the `SameSite=Lax` refresh cookie to flow. `localhost:3000` → `localhost:4000` is same-site.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | FDS §3 cookie attributes; contract §4                                                                                                                                                               |
| D-22 ★ | **The shared contract package's tests live in the package itself** (replaces the former D-17, which put them under `backend/`). The rule-set tests (T-UA-01) are `packages/contracts/src/**/*.test.ts`, run by that package's own `vitest.config.ts`, and owned by the Unit/API Test agent, whose scope is `backend/` plus test files and the Vitest config under `packages/contracts/`. That config's coverage reporters include `lcov` (TH-01), so the package reports its own coverage in `packages/contracts/coverage/lcov.info`, the path `sonar-project.properties` reads. Coverage of `packages/contracts/src/auth/**` is therefore attributed to the package with no cross-root path handling, and the same setup serves every later feature's contract code. Rejected: keeping the tests in `backend/` with `coverage.allowExternal` (B), and excluding the package from Sonar coverage (C).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | FDS frontmatter `coverage_target: 95`; `rules/workflow.md` §2 Phase 8c; `sonar-project.properties`; `.ai/prompts/test-build-mode.md` Unit/API scope; `directives.md` Revision 2 B-1 (option A)      |
| D-23 ★ | **The API fetcher reaches the session layer only through handlers registered at runtime.** `lib/api-client.ts` exports `registerSessionHandlers({ refreshSession, onSessionExpired })` and imports nothing from `features/auth/session/` or `features/auth/api/`. Imports go one way only: `features/auth/session/` → `features/auth/api/` → `lib/api-client.ts`. The session layer may also import `lib/` directly (for `registerSessionHandlers` and the access-token store, which moves to `lib/access-token-store.ts` so the fetcher can attach the Bearer without importing `session/`). `lib/` imports nothing from `features/`. `AuthProvider` registers its `refreshSession` and `expireSession` (FE-10) on mount and unregisters them on unmount (INT-02). A protected `401 UNAUTHENTICATED` calls the registered `refreshSession`, retries once, and calls `onSessionExpired` when the refresh fails or the retry is also a 401. Before any handlers are registered, the fetcher returns the 401 unchanged. The redirect stays in React (`router.replace` inside `expireSession`), and the same registration serves every later feature's protected operations. Rejected: moving the single-flight refresh into `lib/api-client.ts` with an `onSessionExpired(listener)` subscription (B), and refreshing from the TanStack Query cache `onError` handlers (C). | `rules/architecture.md` Forbidden Practices (no circular dependencies); `rules/conventions.md` Imports; REQ-AUTH-06 Renew; contract §7 client retry rule; `directives.md` Revision 3 B-1 (option A) |
| D-24 ★ | **Coverage covers every source file except two thin entry points.** `backend/src/index.ts` and `frontend/src/app/layout.tsx` are excluded from coverage, and no other file is. Neither may contain a rule: `index.ts` only loads `.env` and wires the modules below (BE-14), and `app/layout.tsx` only loads fonts and `globals.css` and renders `<Providers>` (FE-11). Everything else is tested: both `env.ts` modules, `db/client.ts` on a real file path, `db/migrate.ts` through the migration function that `index.ts` and the test harness both call (BE-02), and the providers, pages and layouts (T-UA-11, T-UI-20). The developer adds `sonar.coverage.exclusions=backend/src/index.ts,frontend/src/app/layout.tsx` to `sonar-project.properties` in S-01, and TH-01 and TH-02 mirror it in `coverage.exclude`, so local runs and Sonar exclude the same two source files. Rejected: testing every file, including a refactor of `index.ts` (A), and scoping the 95% target to auth code only (C).                                                                                                                                                                                                                                                                                                                                                              | FDS frontmatter `coverage_target: 95`; `rules/workflow.md` §2 Phase 8 and 8c; `sonar-project.properties`; `directives.md` Revision 3 B-3 (option B)                                                 |

**Known limitations (informational, not planned work):**

- Two tabs refreshing at the same instant can race under strict rotation, and the loser is signed out. The FDS mandates rotation with no grace window and says nothing about multiple tabs.
- Access tokens are stateless. After logout or a password reset, an already-issued access token stays valid until it expires (at most 15 minutes). The next refresh then fails. This is what the FDS session model specifies.

---

## 2. Execution Order and Path Ownership

| Step | Phase                        | Session                               | Tasks                    | May modify                                                                                                                                                                                |
| :--- | :--------------------------- | :------------------------------------ | :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Before Phase 5 (D-01)        | Developer, by hand (no agent session) | S-01                     | `backend/package.json`, `frontend/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.env.example`, `sonar-project.properties` only                                                 |
| 1    | Phase 5, Backend             | Backend Build                         | BE-01 … BE-14            | `backend/**`, `packages/contracts/**`                                                                                                                                                     |
| 1    | Phase 5, Frontend (parallel) | Frontend Build                        | FE-01 … FE-14            | `frontend/**`                                                                                                                                                                             |
| 2    | Phase 6                      | Human UI review                       | §6 checklist             | nothing (review only)                                                                                                                                                                     |
| 3    | Phase 7                      | Integration Build                     | INT-01 … INT-07          | `frontend/**`, `backend/**` (wiring only), `playwright.config.ts`                                                                                                                         |
| 4    | Phase 8, Unit/API            | Unit/API Test agent                   | TH-01, T-UA-01 … T-UA-11 | `backend/**` tests and `backend/vitest.config.ts`; `packages/contracts/src/**/*.test.ts` and `packages/contracts/vitest.config.ts` only, no other file under `packages/contracts/` (D-22) |
| 4    | Phase 8, UI/E2E (parallel)   | UI/E2E Test agent                     | TH-02, T-UI-01 … T-UI-20 | `frontend/**` tests and `frontend/vitest.config.ts`, `e2e/**`                                                                                                                             |

The Frontend Build does not import `@workflow-demo/contracts` during Phase 5, because the Backend Build is creating it in parallel. It builds against mocks shaped exactly like `contract.md` (FE-05). Integration switches it over.

---

## 3. Setup Section

### S-01 · Install approved dependencies and prepare root files · `layer: setup` · owner: **developer, by hand**

- **Owner:** the developer, manually, before Phase 5 (D-01, `directives.md` B-2). No Build, Integration or Test agent runs, edits or commits any part of S-01.
- **Files:** `backend/package.json`, `frontend/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.env.example`, `sonar-project.properties`. Nothing else.
- **Commands,** run in order from the repository root on a clean working tree:
  1. Edit `pnpm-workspace.yaml`: add `argon2: true` under the existing `allowBuilds` map, so the map reads `argon2: true`, `better-sqlite3: true`, `esbuild: true`. Do this first, so argon2's build script is allowed when it is installed.
  2. Backend dependencies:
     `pnpm --filter @workflow-demo/backend add argon2 jose@^5 google-auth-library cookie-parser`
  3. Backend dev dependency:
     `pnpm --filter @workflow-demo/backend add -D @types/cookie-parser`
  4. Frontend dependencies:
     `pnpm --filter @workflow-demo/frontend add @react-oauth/google @ts-rest/core@~3.52.0`
     (`@ts-rest/react-query` 3.52.1 requires `@ts-rest/core ~3.52.0` as a peer and does not re-export `tsRestFetchApi` or `ApiFetcherArgs`, which the INT-02 fetcher imports. Revision 3 B-2.)
  5. Append these lines to `.env.example`, below the existing entries:
     ```
     # Secret for signing access tokens (HS256). Required, at least 32 characters. Set a real value in .env.
     JWT_SECRET=
     # Google OAuth client ID, used as the ID-token audience. Optional in development; required when NODE_ENV=production.
     GOOGLE_CLIENT_ID=
     # development | production. The refresh cookie gets the Secure flag only in production.
     NODE_ENV=development
     # Frontend variables NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_GOOGLE_CLIENT_ID go in frontend/.env.local, not here.
     ```
  6. Append these lines to `sonar-project.properties`, directly below the `sonar.javascript.lcov.reportPaths` line (D-24):
     ```
     # Thin process/framework entry points with no rules (auth plan D-24). Everything else under the src/ trees counts toward coverage.
     sonar.coverage.exclusions=backend/src/index.ts,frontend/src/app/layout.tsx
     ```
  7. `pnpm install`
  8. Confirm argon2's native build ran and loads:
     `cd backend && node -e "require('argon2').hash('x').then(h => console.log(h.startsWith('\$argon2id\$') ? 'argon2 ok' : 'argon2 unexpected hash'))" && cd ..`
     It must print `argon2 ok`.
  9. `pnpm typecheck`
  10. Commit these six files alone:
      `git add backend/package.json frontend/package.json pnpm-workspace.yaml pnpm-lock.yaml .env.example sonar-project.properties`
      `git commit -m "chore(auth): add approved auth dependencies and coverage exclusions"`
- **Done when:** steps 7–9 succeed, `git status` shows none of the six files as modified, and the commit contains exactly those six files. Phase 5 does not start before this commit exists.
- **Trace:** FDS §2 (approved libraries, `jose` 5.x, argon2 build script); FDS frontmatter `coverage_target: 95`; D-01; D-24; `directives.md` Revision 1 B-2, Revision 3 B-2 and B-3.

**Developer action (not a task):** add a real `JWT_SECRET` (at least 32 characters) to the local, git-ignored root `.env` before running the backend. Optionally add `GOOGLE_CLIENT_ID` there and the matching `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `frontend/.env.local`.

---

## 4. Backend Section (`layer: backend`, paths `backend/` and `packages/contracts/`)

Layering follows `rules/architecture.md`. Presentation (router, `requireAuth`, cookie helpers, error handler) calls Services only. Services hold every business rule and never see `req`/`res`. Repositories are the only code that touches Drizzle. Every collaborator reaches the app through `createApp(deps)`, so tests can inject an in-memory database, a controllable clock, a capturing mailer and a fake Google verifier.

**Named constants** (one module, used everywhere): access token lifetime 900 s (also `expiresIn`); refresh token lifetime 604 800 s (also cookie Max-Age); reset token lifetime 30 min; refresh and reset token size 32 bytes, base64url; cookie name `refresh_token`; cookie path `/api/v1/auth`; forgot-password message (contract §2.4); Google fallback name `User`.

### BE-01 · Environment configuration

- **Files:** `backend/src/config/env.ts`.
- Validate the environment at startup and exit with a clear message if it is invalid:
  - `JWT_SECRET` required, at least 32 characters
  - `GOOGLE_CLIENT_ID` required only when `NODE_ENV=production` (D-08). **An empty value counts as unset** (A-8), so an empty `GOOGLE_CLIENT_ID` fails validation in production and leaves Google unconfigured otherwise.
  - `FRONTEND_ORIGIN` defaults to `http://localhost:3000`
  - `NODE_ENV` optional
  - `DATABASE_PATH` defaults to `data/app.db`
  - `PORT` defaults to 4000
- **Testable without a process exit (D-24):** `env.ts` exports a function that takes an environment object (for example `loadConfig(env)`) and returns the typed config or throws an error whose message names the failing variable and rule. `index.ts` calls it with `process.env`, prints the message and exits. All rules and defaults live in `env.ts`; `index.ts` holds none.
- The config is passed to `createApp` as an explicit object, never read ad hoc from `process.env` elsewhere. Keep the existing `.env` loading behavior of `index.ts`.
- **Done when:** a missing `JWT_SECRET` stops startup with a readable error. Tests: T-UA-11.
- **Trace:** FDS §2, §3 (cookie `Secure` flag), REQ-AUTH-03 (audience); D-08; D-24.

### BE-02 · Database bootstrap, schema and migrations

- **Files:** `backend/src/db/client.ts`, `backend/src/db/migrate.ts`, `backend/src/db/schema/index.ts`, `backend/src/db/schema/auth.ts`, `backend/src/db/migrations/**`, `backend/drizzle.config.ts`, `backend/package.json` (scripts `db:generate`, optionally `db:migrate`).
- **Opening the database** (`client.ts` exports the open function, for example `openDatabase(path)`):
  - Resolve `DATABASE_PATH` against the process working directory and create the parent directory if it is missing.
  - Enable foreign keys and WAL journal mode.
  - Support `:memory:` for tests.
- **Applying migrations:** `migrate.ts` exports the migration function (for example `runMigrations(db)`). `index.ts` (BE-14) and the test harness (§8.1) both call this same function, so it is covered by tests and is **not** excluded from coverage (D-24).
- **Tables** (timestamps are ISO-8601 UTC text; IDs are UUIDs generated in code):
  - `users`
    - `id` PK
    - `name` not null
    - `email` not null unique, stored lowercase
    - `password_hash` nullable
    - `provider` not null, `email` | `google`
    - `google_id` nullable unique
    - `created_at`, `updated_at` not null
    - table check: `password_hash` or `google_id` is not null
  - `refresh_tokens`
    - `id` PK
    - `user_id` FK → `users.id` on delete cascade, indexed
    - `token_hash` not null unique (SHA-256 hex)
    - `expires_at` not null
    - `revoked_at` nullable
    - `created_at` not null
  - `password_reset_tokens`
    - `id` PK
    - `user_id` FK → `users.id` on delete cascade, indexed
    - `token_hash` not null unique
    - `expires_at` not null
    - `used_at` nullable
    - `created_at` not null
- Generate the migration with drizzle-kit. **drizzle-kit 0.24.2 ignores `check()`** (Revision 4 B-1), so before committing, add `CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)` to the generated `CREATE TABLE users` statement by hand. Any later generated migration that rebuilds `users` must add it again. Apply the migrations at startup.
- **Done when:** a fresh start creates `data/app.db` with the three tables. The same migrations apply cleanly to `:memory:`. Tests: T-UA-11 (file path, pragmas, migration function) and the harness in §8.1.
- **Trace:** FDS §3 (all three entities, "at least one of the two"), `rules/architecture.md` Database; D-24.

### BE-03 · Shared contract package for `auth`

- **Files:** `packages/contracts/src/index.ts`, `packages/contracts/src/common/error-body.ts`, `packages/contracts/src/auth/auth-validation.ts`, `packages/contracts/src/auth/auth-contract.ts` (kebab-case; exact split may vary).
- Translate `contract.md` into the typed contract package mandated by `rules/tech-stack.md`, with no deviation:
  - `ErrorBody` shape and the error-code catalog (contract §2.5, §3), exported for reuse by other features (contract §9).
  - `PublicUser`, `SessionPayload`, `SuccessAck`, `ForgotPasswordAck` (contract §2).
  - The six rule sets and six composed sets (contract §5), with the FDS §5 messages verbatim.
    - Rule order must make the first failing rule the first reported issue for each field.
    - Absent or non-string values produce the "empty" message.
    - The `confirmPassword` match check still runs when other fields have failed.
    - `NewPasswordFields` must be usable on its own by the reset form.
  - The eight operations with their method, path, body and **every declared response status** (contract §6–§7), so both clients can branch on status without `any`.
  - **Every route carries the full path, including `/api/v1/auth`** (A-3), for example through the router's `pathPrefix` option. The backend mounts these routes with no extra prefix (BE-14), and the frontend client's base URL is the API origin only (INT-02).
- Public exports the frontend will rely on at Integration:
  - Contract router: `authContract`
  - Request schemas: `signUpRequestSchema`, `signInRequestSchema`, `googleSignInRequestSchema`, `forgotPasswordRequestSchema`, `newPasswordFieldsSchema`, `resetPasswordRequestSchema`
  - Shape schemas: `publicUserSchema`, `sessionPayloadSchema`, `errorBodySchema`
  - An error-code constant object
  - Inferred types for each of the above
- Ensure both workspaces can consume the package. The backend's `tsc` typecheck and build must accept the TypeScript-source workspace package, so adjust `backend/tsconfig.json` if `rootDir` or module resolution rejects it. The frontend side is handled in INT-01.
- **Done when:** `pnpm typecheck` passes for `packages/contracts` and `backend`, and the exports above exist.
- **Trace:** FDS §5 (validation messages defined once), §6; REQ-AUTH-08 (shared error shape); `rules/architecture.md` API Contracts.

### BE-04 · Error model and HTTP error translation

- **Files:** `backend/src/shared/errors/domain-error.ts`, `backend/src/shared/errors/error-handler.ts`, `backend/src/shared/http/validation-error.ts`, `backend/src/features/auth/auth-errors.ts`.
- **Domain errors** carry a code and no HTTP status: `InvalidResetTokenError`, `InvalidCredentialsError`, `InvalidGoogleTokenError`, `UnauthenticatedError`, `EmailAlreadyExistsError`.
- **Error handler** (Presentation):
  - Maps each domain error to the status and fixed message in contract §3.
  - Maps a malformed-JSON `SyntaxError` to `400 VALIDATION_ERROR` with empty `fieldErrors`.
  - Maps anything else to `500 INTERNAL_ERROR`, never leaking a stack trace.
  - Adds a JSON `404 NOT_FOUND` fallback.
- **Request validation handler:** turns a validation failure into `400 VALIDATION_ERROR` with `fieldErrors` holding the first message per field.
- **Done when:** each mapping has a route-level test path (tests in T-UA-08).
- **Trace:** FDS §6 Error Responses; `rules/architecture.md` Error Handling; D-07.

### BE-05 · Ports and adapters for external libraries

- **Files:** under `backend/src/features/auth/ports/`: `password-hasher.ts`, `access-token-signer.ts`, `google-token-verifier.ts`, `mailer.ts`, `token-generator.ts`. Plus `backend/src/shared/clock.ts`.
- `PasswordHasher` wraps argon2 with the argon2id variant. Cost parameters come from config, and only tests may lower them.
- `AccessTokenSigner` wraps jose:
  - Signs HS256 with `sub = userId` and `exp = iat + 900`.
  - Verifies with HS256 as the only allowed algorithm and requires a string `sub`.
  - Uses the injected clock.
- `GoogleTokenVerifier` wraps google-auth-library `verifyIdToken` with `audience = GOOGLE_CLIENT_ID`:
  - Returns `sub`, `email`, `email_verified` and `name`.
  - Any failure, a missing `sub` or `email`, or `email_verified !== true` is reported as invalid.
  - When no client ID is configured, it reports invalid without calling Google (D-08).
- `Mailer` port with a `ConsoleMailer` that logs the reset URL. This is the only implementation in scope.
- `TokenGenerator` produces 32 random bytes as base64url and hashes them with SHA-256 hex, using `node:crypto`.
- `Clock` returns the current time and can be injected.
- **Trace:** FDS §2, §3 Session Model, REQ-AUTH-03, REQ-AUTH-05 (Mailer port, ConsoleMailer), REQ-AUTH-08.

### BE-06 · Repositories and unit of work

- **Files:** `backend/src/features/auth/user-repository.ts`, `refresh-token-repository.ts`, `password-reset-token-repository.ts`, `user-mapper.ts`, plus a small unit-of-work helper (for example `auth-persistence.ts`) that runs a callback inside a Drizzle transaction with transaction-bound repositories.
- **User repository:**
  - find by id, email or Google ID
  - create user: returns either the user or an "email taken" result on a UNIQUE violation; never throws for that case
  - link Google ID (bumps `updated_at`)
  - update password hash (bumps `updated_at`)
- **Refresh-token repository:**
  - create
  - find by hash
  - revoke one (only if not already revoked)
  - revoke all for a user
- **Reset-token repository:**
  - invalidate all unused tokens for a user (sets `used_at`)
  - create
  - find by hash
  - mark used
- The mapper produces `PublicUser` (id, name, email) only.
- Repositories contain no business rules.
- Because `better-sqlite3` transactions are synchronous, services hash passwords **before** they open a transaction.
- **Trace:** FDS §3; `rules/architecture.md` Repository Layer, Transactions.

### BE-07 · Session issuer

- **Files:** `backend/src/features/auth/session-issuer.ts` (Service layer).
- Issues a session for a user id:
  - Signs the access token.
  - Generates a raw refresh token and stores only its hash, expiring in 7 days.
  - Returns the access token, `expiresIn = 900` and the raw refresh token.
- The raw refresh token is handed to Presentation only for the cookie and never goes into a response body.
- **Trace:** FDS §3 Session Model; REQ-AUTH-06 Establish.

### BE-08 · Register and login

- **Files:** `backend/src/features/auth/auth-service.ts`.
- **Register:**
  - Lowercase the email.
  - Reject with `EmailAlreadyExistsError` if any account has it.
  - Hash the password (argon2id) and create the user with `provider = "email"` and no Google ID.
  - If the create step reports "email taken" (a race), also raise `EmailAlreadyExistsError`.
  - Do not create a profile.
  - Issue a session.
- **Login:**
  - Lowercase the email.
  - An unknown email, a null password hash, or a failed verification all raise the same `InvalidCredentialsError`, with the dummy-hash timing guard (D-16).
  - Otherwise issue a session.
- **Trace:** REQ-AUTH-01, REQ-AUTH-02, FDS §5 (duplicate registration), §7 AC2, AC3, AC6, AC7.

### BE-09 · Google sign-in

- **Files:** `auth-service.ts` (method), plus a pure name-resolution function (for example `resolve-google-name.ts`).
- Verify the token through the port; any failure raises `InvalidGoogleTokenError`. Lowercase the email.
- Resolve the account in this order:
  1. An account with this Google ID exists: sign it in without writes.
  2. Otherwise, an account with this email exists:
     - Its Google ID is null: link the Google ID, keeping the provider and password hash.
     - Its Google ID has a different value: raise `InvalidGoogleTokenError` with no write.
  3. Otherwise, create a `google` account with no password and the resolved name. On an "email taken" race, retry once from step 2 (D-14).
- Issue a session.
- **Name resolution:**
  - Use the trimmed `name` claim if it has at least 2 characters.
  - Otherwise use the email's local part if it has at least 2 characters.
  - Otherwise use `User`.
- **Trace:** REQ-AUTH-03 (all bullets), §7 AC8.

### BE-10 · Refresh, current user, logout

- **Files:** `auth-service.ts` (methods).
- **Refresh:**
  - Missing or empty token → `UnauthenticatedError`.
  - Look up the token by hash. Unknown, revoked or expired (`expiresAt <= now`) → `UnauthenticatedError`.
  - Missing user → `UnauthenticatedError`.
  - In one transaction, revoke the presented token and insert the new one. The revoke is **conditional** (`revoked_at IS NULL`) and runs first. The BE-06 "revoke one" method reports whether a row changed. If 0 rows changed, a concurrent refresh already rotated this token: raise `UnauthenticatedError`, roll back, and insert nothing. The lookup above is only a fast path, because async work (JWT signing) between the lookup and the transaction lets two requests with the same token both pass it.
  - Return `SessionPayload` data plus the new raw token.
  - No reuse-detection family revocation (not in the FDS).
- **Current user:** find by id. Missing → `UnauthenticatedError`.
- **Logout:** revoke the presented token if it is known and not yet revoked. Every other case succeeds silently.
- **Trace:** REQ-AUTH-06 (Restore, Renew, Current user, End), FDS §3 Rotation, §7 AC10, AC13.

### BE-11 · Password reset service

- **Files:** `backend/src/features/auth/password-reset-service.ts`.
- **Request:**
  - Lowercase the email and look it up.
  - If the account exists (including Google-only):
    - In one transaction, invalidate earlier unused tokens and create a new one expiring in 30 minutes.
    - Then send `<FRONTEND_ORIGIN>/reset-password?token=<raw>` to the mailer.
  - Always return the identical `ForgotPasswordAck`.
- **Reset:**
  - Look up the token by hash. Unknown, used or expired (`expiresAt <= now`) → `InvalidResetTokenError`.
  - Hash the new password before the transaction.
  - In one transaction: mark the token used, set the password hash (provider unchanged), revoke all of the user's refresh tokens. "Mark used" is **conditional** (`used_at IS NULL`) and runs first. The BE-06 "mark used" method reports whether a row changed. If 0 rows changed, a concurrent reset already used this token: raise `InvalidResetTokenError`, roll back, and change nothing. The lookup above is only a fast path, because the async argon2 hash between the lookup and the transaction lets two requests with the same token both pass it.
  - Return `SuccessAck`. No session is issued.
- **Trace:** REQ-AUTH-05 Steps 1 and 2, §7 AC11, AC12.

### BE-12 · `requireAuth` middleware

- **Files:** `backend/src/features/auth/require-auth.ts`, plus an Express `Request` type augmentation adding an optional `userId`, and a helper that returns the authenticated user id as a string or throws `UnauthenticatedError`.
- Accept only the exact `Bearer <token>` scheme and verify through the signer port.
- On success, set `userId` and continue. Any failure → `UnauthenticatedError` → `401 UNAUTHENTICATED`.
- No database lookup.
- Exported for every other feature's router.
- **Trace:** REQ-AUTH-08, §7 AC15.

### BE-13 · Auth router and cookie helpers

- **Files:** `backend/src/features/auth/auth-router.ts`, `backend/src/features/auth/refresh-cookie.ts`.
- Implement the eight operations from `authContract` using the ts-rest Express adapter.
- Handlers stay thin: read the body, cookie or `userId`, call the service, set or clear the cookie, and return the declared status.
- `/me` is behind `requireAuth`.
- Cookie attributes exactly as contract §4, with `Secure` only in production.
  - Set the cookie on register, login, google and successful refresh.
  - Clear it on refresh failure and on every logout.
- The raw refresh token never appears in a JSON body.
- **Trace:** FDS §3 cookie attributes, §6 all endpoints, REQ-AUTH-01 to 06.

### BE-14 · App factory, CORS and entry point

- **Files:** `backend/src/app.ts`, `backend/src/index.ts`.
- **`createApp(deps)`** builds the Express app without calling `listen`. Middleware order:
  1. CORS
  2. JSON body parser (100 kB)
  3. cookie parser
  4. `GET /health` (unchanged)
  5. auth router, registered at the app root with **no extra mount prefix**: its routes already carry the full `/api/v1/auth/...` path from the typed contract (BE-03, A-3), so every operation is served exactly once, at its contract §6 path
  6. JSON 404
  7. error handler
- **CORS** stays hand-rolled (no `cors` package is approved) and follows contract §8:
  - the exact origin, `Vary: Origin`, credentials allowed, `Authorization` allowed
  - `OPTIONS` → 204
- **`index.ts`** is wiring only and holds no rules, because it is excluded from coverage (D-24):
  1. Load env (existing behavior).
  2. Validate the config by calling the BE-01 function with `process.env`; on error, print its message and exit.
  3. Open the database (BE-02 open function) and call the BE-02 migration function.
  4. Wire the production adapters.
  5. Call `listen(PORT)`.
- **Done when:** `pnpm dev` in `backend/` starts, `/health` still answers, and `pnpm lint` and `pnpm typecheck` pass.
- **Trace:** FDS §3 (CORS requirements), REQ-AUTH-08, `rules/architecture.md` Presentation Layer; D-24.

---

## 5. Frontend Section (`layer: frontend`, path `frontend/`)

All new paths are under `frontend/src/`. Files are kebab-case and components PascalCase. Every page and layout is a client component (CSR). Pages that read query parameters (`/auth`, `/reset-password`) wrap their client content in a Suspense boundary with the full-page loader, as Next 14 requires.

### 5.1 Directory layout

| Area                        | Files                                                                                                                                                                                                                                                                                          |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                      | `layout.tsx` (modify), `providers.tsx`, `page.tsx` (replace), `auth/page.tsx`, `reset-password/page.tsx`, `(protected)/layout.tsx`, `(protected)/dashboard/page.tsx`                                                                                                                           |
| `components/ui/` (shared)   | `button.tsx`, `icon-input.tsx`, `password-input.tsx`, `field-error.tsx`, `form-alert.tsx`, `full-page-loader.tsx`, `toast.tsx`, `icons.tsx`                                                                                                                                                    |
| `lib/`                      | `cn.ts`, `env.ts`, `access-token-store.ts` (FE-10, D-23) (`api-client.ts` arrives in INT-02). Nothing under `lib/` imports from `features/`.                                                                                                                                                   |
| `features/auth/components/` | `auth-card.tsx`, `sign-in-form.tsx`, `sign-up-form.tsx`, `brand-panel.tsx`, `fintrack-logo.tsx`, `google-sign-in-button.tsx`, `forgot-password-dialog.tsx`, `reset-password-card.tsx`, `reset-password-form.tsx`, `invalid-reset-link.tsx`, `dashboard-placeholder.tsx`, `sign-out-button.tsx` |
| `features/auth/session/`    | `auth-provider.tsx`, `session-refresh.ts`, `use-auth.ts`                                                                                                                                                                                                                                       |
| `features/auth/guards/`     | `protected-route.tsx`, `guest-only-route.tsx`                                                                                                                                                                                                                                                  |
| `features/auth/hooks/`      | `use-auth-mode.ts`, `use-sign-in.ts`, `use-sign-up.ts`, `use-google-sign-in.ts`, `use-request-password-reset.ts`, `use-reset-password.ts`, `use-current-user.ts`                                                                                                                               |
| `features/auth/api/`        | `auth-api.ts`, the single module every hook and the session layer call. It is mock-backed in Phase 5 and switched to the real client in INT-03.                                                                                                                                                |
| `features/auth/lib/`        | `auth-copy.ts`, `auth-error.ts`, `apply-field-errors.ts`                                                                                                                                                                                                                                       |
| `features/auth/mocks/`      | `auth-mock-api.ts`, `auth-mock-data.ts`, `auth-form-schemas.mock.ts`, `auth-types.mock.ts` (all deleted in INT-04 and INT-05)                                                                                                                                                                  |

### 5.2 User-facing copy catalog (`features/auth/lib/auth-copy.ts`)

Field validation messages are **not** here; they come from the shared rule sets (contract §5). Server `message` values are never shown (contract §2.5), except the forgot-password success message, which falls back to `RESET_REQUEST_SENT`.

| Key                                | Text                                                                              | Source                  |
| :--------------------------------- | :-------------------------------------------------------------------------------- | :---------------------- |
| `SIGN_IN_TITLE`, `SIGN_IN_DIVIDER` | Sign in to FinTrack · or use your account                                         | REQ-AUTH-02             |
| `SIGN_UP_TITLE`, `SIGN_UP_DIVIDER` | Create Account · or use your email for registration                               | REQ-AUTH-01             |
| `SIGN_IN_INVITE_HEADING`, `_TEXT`  | Hello, Friend! · Enter your personal details and start journey with us            | REQ-AUTH-02             |
| `SIGN_UP_INVITE_HEADING`, `_TEXT`  | Welcome Back! · Log in to manage your finances.                                   | REQ-AUTH-01             |
| Button labels                      | SIGN IN · SIGN UP · SEND RESET LINK · BACK TO SIGN IN · RESET PASSWORD · Sign out | REQ-AUTH-01/02/05/06    |
| `FORGOT_PASSWORD_LINK`             | Forgot your password?                                                             | REQ-AUTH-02             |
| `RESET_DIALOG_TITLE`               | Reset your password                                                               | REQ-AUTH-05             |
| `RESET_REQUEST_SENT`               | If an account exists for that email, a reset link has been sent.                  | REQ-AUTH-05 (fallback)  |
| `INVALID_CREDENTIALS`              | Invalid email or password                                                         | behavior §4             |
| `EMAIL_EXISTS_TOAST`               | An account with this email already exists.                                        | behavior §3             |
| `SIGN_UP_FAILED_TOAST`             | Could not create your account. Please try again.                                  | FDS §5 Generic Failure  |
| `SIGN_IN_FAILED_TOAST`             | Could not sign in. Please try again.                                              | FDS §5 Generic Failure  |
| `GOOGLE_UNAVAILABLE_TOAST`         | Google sign-in is unavailable.                                                    | REQ-AUTH-03             |
| `GOOGLE_FAILED_TOAST`              | Google sign-in failed. Please try again.                                          | REQ-AUTH-03, FDS §5     |
| `RESET_REQUEST_FAILED`             | Could not send the reset link. Please try again.                                  | FDS §5, behavior §6     |
| `RESET_FAILED`                     | Could not reset your password. Please try again.                                  | FDS §5                  |
| `RESET_LINK_INVALID`               | This reset link is invalid or has expired.                                        | REQ-AUTH-05             |
| `PASSWORD_UPDATED_TOAST`           | Password updated. Please sign in.                                                 | REQ-AUTH-05             |
| Placeholders                       | Name · Email · Password · Confirm Password · New Password · Confirm New Password  | visuals, REQ-AUTH-05    |
| `SIGNED_IN_AS`                     | Signed in as {name}                                                               | REQ-AUTH-07 placeholder |

### 5.3 State matrix

| Screen / element                   | Loading                                              | Success                             | Error                                                                                                           | Empty / invalid input                          |
| :--------------------------------- | :--------------------------------------------------- | :---------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| App load (`/`, protected, `/auth`) | Full-page loader while restore is pending            | Redirect or render per guard        | Restore failure (401, network, 5xx) → unauthenticated, no toast                                                 | —                                              |
| Sign in                            | Submit disabled with spinner                         | `/dashboard`                        | `INVALID_CREDENTIALS` → inline alert and shake; anything unexpected → toast `SIGN_IN_FAILED_TOAST`              | Inline field errors, no request                |
| Sign up                            | Submit disabled with spinner                         | `/dashboard`                        | `EMAIL_ALREADY_EXISTS` → toast; `VALIDATION_ERROR` → inline; anything unexpected → toast `SIGN_UP_FAILED_TOAST` | Inline field errors, no request                |
| Google                             | Spinner on the button; the form's submit is disabled | `/dashboard`                        | `INVALID_GOOGLE_TOKEN` or unexpected → toast `GOOGLE_FAILED_TOAST`; unavailable → toast on click (D-02)         | Popup dismissed → nothing                      |
| Forgot dialog                      | SEND RESET LINK disabled with spinner                | Generic message and BACK TO SIGN IN | Inline `RESET_REQUEST_FAILED`, form stays open with its value                                                   | Inline field error, no request                 |
| Reset page                         | RESET PASSWORD disabled with spinner                 | Toast and `/auth?mode=signin`       | `INVALID_RESET_TOKEN` → invalid-link state; `VALIDATION_ERROR` → inline; other → inline `RESET_FAILED`          | Missing token → invalid-link state, no request |
| Dashboard placeholder              | Name from the session shown at once                  | Name and Sign out                   | Protected 401 → refresh and retry once; on refresh failure → `/auth`                                            | —                                              |
| Sign out                           | Button disabled                                      | `/auth`                             | Local session still cleared, still `/auth`                                                                      | —                                              |

### FE-01 · Design tokens, fonts and utilities

- **Files:** `frontend/tailwind.config.ts`, `app/layout.tsx`, `lib/cn.ts`, `lib/env.ts`.
- **Tailwind (additive only):**
  - Add `brand` colors: teal about `#00B894` with a darker hover, gradient from about `#4ACFAC` to about `#1B5E52`, ink about `#2D2D2D`.
  - Add a `shake` keyframe and animation (about 400 ms, ±6 px).
  - Do **not** change the existing `primary` token.
- **Fonts:** load Inter (bound to the existing `--font-inter` variable) and Poppins through `next/font/google` (D-04).
- **`lib/cn.ts`:** clsx plus tailwind-merge.
- **`lib/env.ts`:** reads `NEXT_PUBLIC_API_BASE_URL` (fallback `http://localhost:4000`, D-19) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional; an empty value counts as unset, so Google is unavailable). Read each variable by direct `process.env.NEXT_PUBLIC_…` property access, the only form Next inlines into the client bundle. Tested by T-UI-20 (D-24).
- **`app/layout.tsx`** holds no logic: it loads the fonts and `globals.css` and renders `<Providers>` (FE-11). It is one of the two files excluded from coverage (D-24), so nothing with a rule may be added to it.
- **Trace:** visuals; REQ-AUTH-01, 02 (teal buttons, gradient overlay); REQ-AUTH-03 (client ID env var); D-19; D-24.

### FE-02 · UI primitives

- **Files:** `components/ui/icons.tsx`, `button.tsx`, `icon-input.tsx`, `password-input.tsx`, `field-error.tsx`, `form-alert.tsx`, `full-page-loader.tsx`.
- **Icons:** inline SVG for user, mail, lock, eye, eye-off, close, spinner and a grey "G" (D-18).
- **Sizes are CSS pixels** (A-1). The reference PNGs are 2880 × 1912, a 2× capture of a 1440 × 956 viewport, so halve any measurement taken from the PNG.
- **`Button`** (cva variants primary, overlay, link):
  - Uppercase, about 160 × 40 CSS px.
  - An `isLoading` prop shows a spinner and sets disabled and `aria-busy`.
- **`IconInput`:**
  - Forwards its ref for React Hook Form, with a leading icon slot and an optional trailing slot.
  - Error state sets a red border, `aria-invalid` and `aria-describedby`.
  - Has a real visually hidden `<label>` (Radix Label).
  - About 320 × 48 CSS px, with a grey border.
- **`PasswordInput`:**
  - Lock icon plus a trailing `type="button"` eye toggle with local visibility state that switches `password`/`text`.
  - The toggle's `aria-label` switches between "Show password" and "Hide password", with `aria-pressed` and `aria-controls`.
  - Each instance is independent, and the toggle never submits the form.
- **`FieldError`:** inline text with an id.
- **`FormAlert`:** `role="alert"`.
- **`FullPageLoader`:** a centered spinner with sr-only "Loading…".
- **Trace:** REQ-AUTH-01, 02 (icon adornments), REQ-AUTH-04, FDS §5 (inline errors), visuals.

### FE-03 · Toast system

- **Files:** `components/ui/toast.tsx`.
- `ToastProvider` keeps a queue in React state. `useToast()` exposes success and error. The viewport sits fixed at the top right.
- **Behavior:**
  - Variants: success (teal/green) and error (red).
  - Each toast has a close button and auto-dismisses after about 5 seconds.
  - Error toasts use `role="alert"` and success toasts `role="status"`, inside an `aria-live` region.
  - An identical message that is still visible is not shown twice.
- The provider sits in the root layout, so a toast survives client navigation (needed for the reset success redirect).
- **Trace:** FDS §5 Generic Failure Feedback, behavior §3, §5, §6, REQ-AUTH-05 (success toast after redirect).

### FE-04 · Copy catalog and error mapping

- **Files:** `features/auth/lib/auth-copy.ts` (table 5.2), `auth-error.ts`, `apply-field-errors.ts`.
- **`auth-error.ts`** maps an operation outcome (status, `code`, or a network failure) to a discriminated union:
  - field errors
  - invalid credentials
  - email exists
  - invalid Google token
  - invalid reset token
  - unauthenticated
  - unexpected
- Any status or code not declared for that operation in contract §7 becomes "unexpected".
- **A `VALIDATION_ERROR` with nothing to show becomes "unexpected"** (A-4): when its `fieldErrors` has no key for a field on the submitting form, including an empty map (for example after malformed JSON) or a map holding only `token`, the outcome is "unexpected", so the FDS §5 Generic Failure Feedback for that form applies instead of silent failure. The mapping therefore takes the form's field names as input.
- **`apply-field-errors.ts`** puts each `fieldErrors` entry onto the matching React Hook Form field as a server error and ignores keys with no form field (for example `token`, alongside at least one mappable key).
- **Trace:** FDS §5, §6 Error Responses; contract §2.5, §7.

### FE-05 · Phase 5 mock layer (removed in Integration)

- **Files:**
  - `features/auth/api/auth-api.ts`: one function per contract operation, returning the contract's success body or a typed failure.
  - `features/auth/mocks/auth-mock-api.ts`
  - `auth-mock-data.ts`
  - `auth-form-schemas.mock.ts`: temporary copies of the contract §5 rule sets with exact FDS messages and trimming (D-05).
  - `auth-types.mock.ts`: `PublicUser`, `SessionPayload`, `ErrorBody` and the request shapes, mirroring contract §2 and §6 field for field.
- **Mock behavior:**
  - State lives in module memory only, never Web Storage, with about 400 ms of latency per call.
  - Existing user: Piyush Kumar, `piyush@example.com`, password `Passw0rd!`.
  - Google-only user: `gia@example.com`. Logging in with it gives invalid credentials.
  - Signing up with `piyush@example.com` or `taken@example.com` gives `EMAIL_ALREADY_EXISTS`.
  - Any email containing `fail@` gives a simulated network failure.
  - Reset token `valid-token` succeeds; any other token gives `INVALID_RESET_TOKEN`.
  - Google credential `bad-credential` gives `INVALID_GOOGLE_TOKEN`; any other credential succeeds.
  - Refresh returns 401 until a mock sign-in or sign-up has happened in this JS session, then returns `expiresIn: 900`.
  - Current user returns the session user.
  - Logout always succeeds.
- Hooks and components import only `auth-api.ts`, never the mocks directly, so Integration swaps one module.
- **Trace:** `rules/workflow.md` Phase 5 (mock data shaped to the frozen contract); contract §2, §6.

### FE-06 · Auth card, brand panel, logo, mode handling

- **Files:** `features/auth/components/auth-card.tsx`, `brand-panel.tsx`, `fintrack-logo.tsx`, `features/auth/hooks/use-auth-mode.ts`, `app/auth/page.tsx`.
- **Mode:**
  - `mode` is `signin` when missing or unrecognized, or `signup`.
  - Switching calls `router.push('/auth?mode=<next>')` without scrolling. Push, not replace, so the browser Back button works.
- **Card and layout:**
  - Centered card, about 800 × 600 CSS px (A-1; the visuals are 2× captures of a 1440 × 956 viewport), `rounded-3xl`, soft shadow, on the `#f7f8fa` background.
  - Split 60% form / 40% overlay:
    - `signin`: form on the left, overlay on the right with "Hello, Friend!" and SIGN UP.
    - `signup`: overlay on the left with "Welcome Back!" and SIGN IN, form on the right.
  - Both forms stay mounted. The overlay slides (about 600 ms ease-in-out) and forms cross-fade. `motion-safe` only, so reduced motion switches instantly.
  - The hidden form is `aria-hidden` and `inert`. The active form's title is the `h1`.
  - **Setting `inert`** (A-2): `@types/react` 18 has no `inert` prop, so do not pass it as a JSX attribute. Hold a ref to the form's container and set `element.inert = isHidden` in an effect keyed on `isHidden`. The property is typed by `lib.dom`, so no cast or `any` is needed.
- **Clearing the hidden view:** an effect keyed on `mode` resets the hidden form's values, errors, alert and shake state. Because it is keyed on `mode`, Back and Forward navigation also clear it.
- **Small screens:** as in D-03.
- **Brand panel:** diagonal emerald-to-dark-green gradient, the logo, white heading and subtext, and a solid teal toggle button.
- **Trace:** REQ-AUTH-01, REQ-AUTH-02 (panel layouts and copy), behavior §1, §2, FDS §7 AC1.

### FE-07 · Sign-up form

- **Files:** `features/auth/components/sign-up-form.tsx`, `features/auth/hooks/use-sign-up.ts`.
- **Layout:**
  - Title "Create Account", then the Google button, then the divider "or use your email for registration".
  - Fields: Name (user icon, `autoComplete="name"`), Email (mail icon, `type="email"`), Password and Confirm Password (`PasswordInput`, `autoComplete="new-password"`, independent toggles).
  - SIGN UP button.
- **Validation:**
  - The `<form>` has `noValidate`, so the browser's native `type="email"` check never blocks submit or shows its own tooltip, and the FDS §5 inline messages always appear.
  - React Hook Form with the sign-up rule set.
  - Validate on submit, then re-validate on change. First error per field. Focus moves to the first invalid field.
  - An invalid form sends no request.
- **Outcomes:**
  - Pending: button loading.
  - Success: establish the session (FE-10), then `router.replace('/dashboard')`.
  - `EMAIL_ALREADY_EXISTS`: `EMAIL_EXISTS_TOAST`.
  - `VALIDATION_ERROR`: inline via `apply-field-errors`.
  - Unexpected: `SIGN_UP_FAILED_TOAST`.
- **Trace:** REQ-AUTH-01, REQ-AUTH-04, FDS §5, behavior §3, §7 AC2–AC5.

### FE-08 · Sign-in form

- **Files:** `features/auth/components/sign-in-form.tsx`, `features/auth/hooks/use-sign-in.ts`.
- **Layout:**
  - Title "Sign in to FinTrack", then the Google button, then the divider "or use your account".
  - Fields: Email and Password (`autoComplete="current-password"`).
  - "Forgot your password?" is the dialog trigger (FE-12).
  - SIGN IN button.
- **Validation:** email required and valid; password required only, with no strength rule. The `<form>` has `noValidate` (as FE-07).
- **Outcomes:**
  - `INVALID_CREDENTIALS`:
    - `FormAlert` "Invalid email or password".
    - Both credential inputs replay the shake animation on every failure (attempt counter as a key).
    - Values are kept, and the alert clears on the next submit.
  - `VALIDATION_ERROR`: inline.
  - Unexpected: `SIGN_IN_FAILED_TOAST`.
  - Success: establish the session, then `/dashboard`.
- While a Google sign-in is pending, the submit button is disabled.
- **Trace:** REQ-AUTH-02, REQ-AUTH-04, behavior §4, FDS §7 AC6, AC7.

### FE-09 · Google sign-in button

- **Files:** `features/auth/components/google-sign-in-button.tsx`, `features/auth/hooks/use-google-sign-in.ts`, `features/auth/components/auth-card.tsx` (calls the hook once), and a small Google availability provider (inside `providers.tsx` or its own file under `features/auth/session/`).
- **One Google sign-in state for both panels:** both forms stay mounted (FE-06), so two Google buttons exist at once. Google Identity Services' `initialize` is global, and only the last-registered callback runs, which may belong to the hidden panel. So `use-google-sign-in` is called **once**, in `AuthCard`. Its success handler and its `isPending` flag are passed down to both panels' Google buttons and both forms.
  - Whichever button's callback Google invokes runs the same handler, and the outcome (toast, navigation) is the same.
  - While pending, both buttons show the spinner and both forms' submit buttons are disabled, so the visible form is always the one that reacts.
  - Neither form owns Google state, and the buttons hold no pending state of their own.
- **Availability:** the provider renders the Google OAuth provider only when the client ID is set, and exposes whether Google is available. It becomes unavailable when the ID is missing or the script fails to load.
- **When available:** render the official icon button (circle).
  - On success with a `credential`, call the Google operation with `{ token: credential }`.
  - A missing credential or the error callback is a **no-op**: no toast and no state change.
- **When unavailable:** render the fallback circular "G" button with `aria-label="Sign in with Google"`. Clicking it shows `GOOGLE_UNAVAILABLE_TOAST` (D-02).
- **Outcomes:**
  - `INVALID_GOOGLE_TOKEN` or unexpected: `GOOGLE_FAILED_TOAST`.
  - Success: establish the session, then `/dashboard`.
- While pending, show a spinner on the button and disable the form submit (both panels, from the shared state above).
- It appears on both panels. Google's multicolor style is an accepted deviation from the visuals.
- **Trace:** REQ-AUTH-03 (frontend states), behavior §5, FDS §7 AC8, AC9.

### FE-10 · Session layer

- **Files:** `frontend/src/lib/access-token-store.ts`, `features/auth/session/session-refresh.ts`, `auth-provider.tsx`, `use-auth.ts`.
- **Import direction (D-23):** `features/auth/session/` → `features/auth/api/` → `lib/`. The session layer may import `lib/` directly; nothing under `lib/` or `features/auth/api/` imports from `features/auth/session/`. The API fetcher (INT-02) reaches this layer only through the handlers `AuthProvider` registers at Integration.
- **Token store** (`lib/access-token-store.ts`, moved out of `session/` by D-23): module-scoped access token and expiry with get, set and clear. It is **never** written to localStorage, sessionStorage, cookies or IndexedDB. Living in `lib/` lets the API fetcher (INT-02) read it outside React without importing `session/`. It imports nothing.
- **Single-flight refresh** (`session-refresh.ts`, unchanged in place): one in-flight refresh promise shared by every concurrent caller: restore, the renewal timer, the fetcher's 401 retry (through the registered `refreshSession`), and React StrictMode's double effects. This is required by strict rotation (contract §4). It calls the refresh operation through `features/auth/api/auth-api.ts` only.
- **Auth provider** context: `status` (`loading` | `authenticated` | `unauthenticated`), `user`, and the `establishSession`, `clearSession`, `refreshSession`, `expireSession` and `logout` functions.
  - **Refresh session:** runs the single-flight refresh. On success it establishes the session and resolves `true`. On failure (401, network, 5xx) it resolves `false` and changes nothing; the caller decides what follows. Restore, renewal and the fetcher (INT-02) all use it.
  - **Expire session:** `clearSession()` then `router.replace('/auth')`. This is the single "session is gone" path, used by renewal failure and, from Integration on, by the fetcher's `onSessionExpired` (INT-02). It keeps the redirect inside React.
  - **Restore (on mount):** refresh session. `true` → authenticated. `false` → unauthenticated, with no toast and no redirect.
  - **Establish:** set the token store and user, set status to authenticated, and schedule renewal at `expiresIn − 60 s` (D-09).
  - **Renewal:** refresh session. On `false`, expire the session.
  - **Clear:** empty the token store, cancel the timer, clear the query client cache, set the user to null and the status to unauthenticated.
  - **Logout:** call the logout operation, then **whatever the outcome**, clear the session and `router.replace('/auth')`.
- **Built so Integration only registers:** `refreshSession` and `expireSession` are complete in Phase 5. Their signatures (`() => Promise<boolean>` and `() => void`) are what INT-02's `registerSessionHandlers` accepts, so INT-02 adds one registration effect and changes no FE-10 logic.
- **Trace:** REQ-AUTH-06 (Establish, Restore, Renew, End), FDS §3 Session Model, §5 (restore failure silent), behavior §7, FDS §7 AC6, AC10, AC13; contract §7 client retry rule; D-23.

### FE-11 · Providers, guards and root route

- **Files:** `app/providers.tsx`, `app/layout.tsx`, `app/page.tsx` (replaces the health-check page), `app/(protected)/layout.tsx`, `features/auth/guards/protected-route.tsx`, `guest-only-route.tsx`.
- **Providers**, in the root layout, in order: QueryClient, Toast, Google availability, Auth. The QueryClient sets no default `staleTime` (FE-14 relies on the default of 0).
- **Coverage (D-24):** `app/providers.tsx`, `app/page.tsx` and `app/(protected)/layout.tsx` hold the provider order and guard wiring and are tested by T-UI-20. `app/layout.tsx` stays logic-free (FE-01) and is the only frontend file excluded from coverage.
- **Protected route:**
  - loading → full-page loader (no children, no redirect)
  - unauthenticated → `router.replace('/auth')` and keep the loader
  - authenticated → children
- **Guest-only route** (wraps `/auth`):
  - loading → loader
  - authenticated → `router.replace('/dashboard')`
  - unauthenticated → children
- **Root `/`:** the same three states, redirecting to `/dashboard` or `/auth`.
- **Trace:** REQ-AUTH-07 (guard, loading state, redirects, root route), behavior §8, FDS §7 AC10, AC14; D-24.

### FE-12 · Forgot-password dialog

- **Files:** `features/auth/components/forgot-password-dialog.tsx`, `features/auth/hooks/use-request-password-reset.ts`.
- **Structure:**
  - A Radix Dialog triggered by the "Forgot your password?" link, so focus returns to the link on close.
  - An overlay over the card, the title "Reset your password", an sr-only description, and a close icon button labelled "Close".
  - It closes on Escape, outside click or the close control.
- **Request step:**
  - An email field with a mail icon and SEND RESET LINK.
  - It uses the forgot-password rule set, so invalid input stays inline and sends no request. The `<form>` has `noValidate` (as FE-07).
- **Outcomes:**
  - Pending: button loading.
  - Success: replace the form with the returned `message` (fallback `RESET_REQUEST_SENT`) and a BACK TO SIGN IN button that closes the dialog.
  - Failure: inline `RESET_REQUEST_FAILED`, with the form kept open and its value kept.
- Every time it opens, it resets to an empty request step.
- **Trace:** REQ-AUTH-05 Step 1, behavior §6 Request dialog, FDS §5, §7 AC11.

### FE-13 · Reset-password page

- **Files:** `app/reset-password/page.tsx`, `features/auth/components/reset-password-card.tsx`, `reset-password-form.tsx`, `invalid-reset-link.tsx`, `features/auth/hooks/use-reset-password.ts`.
- **Card:** a centered single-panel card in the same visual language, with the logo.
- **Missing or empty `token`:** render the invalid-link state (`RESET_LINK_INVALID` and a link to `/auth`) with **no request**.
- **Form:**
  - New Password and Confirm New Password (independent eye toggles) and RESET PASSWORD.
  - It uses the new-password rule set (strength and match, same messages), and the URL token is merged into the request.
  - The `<form>` has `noValidate` (as FE-07), so every auth form behaves the same way.
- **Outcomes:**
  - Pending: button loading.
  - Success, in this order:
    1. Call the FE-10 `clearSession()`. This empties the token store, cancels the renewal timer, clears the query cache and sets the status to `unauthenticated`. It is harmless when the visitor was not signed in. Do **not** call `logout()`: the server has already revoked every refresh token, and `logout()` redirects to `/auth` without `mode`.
    2. Show `PASSWORD_UPDATED_TOAST`.
    3. `router.replace('/auth?mode=signin')`.

    The user is not signed in, whether or not they were signed in before (D-12). The guest-only guard on `/auth` then sees `unauthenticated` and shows the sign-in form.

  - `INVALID_RESET_TOKEN`: the invalid-link state.
  - `VALIDATION_ERROR`: inline, where `password` maps to New Password and `confirmPassword` to Confirm New Password.
  - Anything else: inline `RESET_FAILED`.
- No guard (D-12).
- **Trace:** REQ-AUTH-05 Step 2, REQ-AUTH-04, behavior §6 Reset page, FDS §7 AC12.

### FE-14 · Dashboard placeholder and sign out

- **Files:** `app/(protected)/dashboard/page.tsx`, `features/auth/components/dashboard-placeholder.tsx`, `sign-out-button.tsx`, `features/auth/hooks/use-current-user.ts`.
- **Placeholder:** shows "Signed in as {name}" from a current-user query whose initial data is the session user. This gives Integration one real protected request to exercise the Bearer and refresh-retry path.
- **The query refetches `/me` on mount despite its initial data** (A-7). It keeps TanStack Query's default `staleTime` of 0 and sets no `initialDataUpdatedAt`, so the initial data is stale at once and the query fetches when the page mounts. Do not set a longer `staleTime` here or as a QueryClient default (FE-11): T-UI-14 depends on this `/me` request, the only real protected request in this feature.
- **Sign out button:** calls `logout()` and is disabled while pending.
- The `dashboard` feature replaces this page later; the guard and layout stay owned by auth.
- **Trace:** REQ-AUTH-06 (Logout control, Current user), REQ-AUTH-07 (placeholder pages), FDS §7 AC13.

---

## 6. Phase 6 UI Review Checklist

Compared against `visuals/auth-signin-page.png`, `visuals/auth-signup-page.png` and `behavior.md`:

- Card size, radius and shadow. The 60/40 split and panel sides per mode.
- Gradient direction and colors. Teal buttons on both the form and the overlay.
- Title fonts and sizes. Input size, icons and placeholders. Divider copy.
- Logo wordmark and tagline (D-04).
- Slide and cross-fade feel. The shake on invalid credentials.
- Dialog look.
- Reset card look.
- Small-screen layout (D-03).
- The multicolor Google button is an accepted deviation (REQ-AUTH-03).

---

## 7. Integration Section (`layer: integration`)

Runs after both Phase 5 commits and the Phase 6 freeze. No business logic changes.

### INT-01 · Make the contract package consumable by Next

- **Files:** `frontend/next.config.mjs`.
- Add `@workflow-demo/contracts` to Next's transpiled packages, because its entry point is TypeScript source.
- **Done when:** `pnpm --filter @workflow-demo/frontend build` succeeds with a contracts import.
- **Trace:** `rules/architecture.md` (frontend uses clients generated from `packages/contracts`).

### INT-02 · API client with auth-aware fetcher

- **Files:** `frontend/src/lib/api-client.ts`, `frontend/src/features/auth/session/auth-provider.tsx` (registration effect only). `@ts-rest/core` is already a frontend dependency from S-01; Integration installs nothing.
- **Imports (D-23):** `lib/api-client.ts` imports the contract package, `@ts-rest/*`, `lib/env.ts` and `lib/access-token-store.ts`, and **nothing** from `features/auth/session/` or `features/auth/api/`.
- Build the ts-rest React Query client from `authContract`. The base URL is the API origin only, `NEXT_PUBLIC_API_BASE_URL` from `lib/env.ts`, with no path; the contract's routes already carry `/api/v1/auth` (BE-03, A-3). A custom fetcher applies to every request:
  1. Credentials included.
  2. A Bearer header when the token store holds a token.
  3. For **protected** operations only, a `401` with `code = UNAUTHENTICATED` calls the registered `refreshSession` once, then retries the original request once with the token now in the store.
     - If `refreshSession` resolves `false`, call the registered `onSessionExpired` and return the original 401.
     - If the retry is also a 401, call `onSessionExpired` and return that 401. No second refresh, no loop.
     - **No handlers registered** (for example before `AuthProvider` has mounted): return the 401 unchanged, with no refresh.
     - The seven public and cookie operations are never retried (contract §7). The refresh call itself is one of them, so the retry path cannot recurse.
- **Session handler registration (D-23):** `lib/api-client.ts` exports `registerSessionHandlers({ refreshSession, onSessionExpired })`, which stores the handlers and returns an unregister function. `AuthProvider` (FE-10) calls it in a mount effect with its own `refreshSession` and `expireSession`, and calls the returned unregister function in the effect's cleanup, so StrictMode's double mount leaves exactly one registration. No FE-10 logic changes.
- Calls outside React (restore, renewal, logout) use the client's non-hook call methods, so they also go through the contract.
- **Trace:** REQ-AUTH-06 Renew ("If the refresh fails, the session is cleared and the user is redirected to `/auth`"), REQ-AUTH-08 (client side of the 401 contract), FDS §3 (credentials, Bearer), contract §7; D-23.

### INT-03 · Switch the auth API module to the real client

- **Files:** `frontend/src/features/auth/api/auth-api.ts` only. `session-refresh.ts` is **not** changed: it already calls the refresh operation through `auth-api.ts` (FE-10), so switching `auth-api.ts` switches it too.
- Replace the mock-backed functions with real client calls. Hook signatures and components do not change.
- Map responses to the FE-04 outcome union by declared status and `code`.
- **Resulting import graph (D-23):** `features/auth/session/` → `features/auth/api/auth-api.ts` → `lib/api-client.ts`, plus `session/` → `lib/` for `registerSessionHandlers` and the token store. No module under `lib/` or `features/auth/api/` imports `features/auth/session/`, so there is no cycle.
- **Trace:** REQ-AUTH-01 to REQ-AUTH-06; contract §6; `rules/architecture.md` Forbidden Practices (no circular dependencies); D-23.

### INT-04 · Use the shared rule sets in every form

- **Files:** the four form components (FE-07, FE-08, FE-12, FE-13); delete `features/auth/mocks/auth-form-schemas.mock.ts`.
- Forms resolve with the contract package's `signUpRequestSchema`, `signInRequestSchema`, `forgotPasswordRequestSchema` and `newPasswordFieldsSchema`. The frontend no longer defines any validation message itself.
- **Trace:** FDS §5 ("defined once, in the shared schemas"), `rules/architecture.md` (no duplicate types).

### INT-05 · Use contract-inferred types and remove all mocks

- **Files:** every frontend module importing `auth-types.mock.ts`; delete `frontend/src/features/auth/mocks/`.
- Replace the mock types with types inferred from the contract package.
- **Done when:** no file under `frontend/src` references `mocks/`, and lint and typecheck pass.
- **Trace:** `rules/workflow.md` Phase 7 exit criteria ("No mock data remaining").

### INT-06 · End-to-end wiring check (manual, recorded in the Integration log line)

- With both apps running locally and `JWT_SECRET` set, walk through:
  1. Sign up → `/dashboard` shows the name.
  2. Reload → still on `/dashboard`.
  3. Sign out → `/auth`.
  4. Sign in → `/dashboard`.
  5. Forgot password prints a reset URL in the backend console, and opening it lets the password be reset.
  6. Confirm the browser holds an HTTP-only `refresh_token` cookie and Web Storage has no token.
- **Trace:** FDS §7 AC2, AC6, AC10, AC11, AC12, AC13.

### INT-07 · Playwright environment

- **Files:** `playwright.config.ts` (root; Integration may stage it).
- **Backend `webServer` environment:**
  - a fixed test-only `JWT_SECRET` of at least 32 characters
  - the existing `DATABASE_PATH=data/e2e-test.db`
  - `GOOGLE_CLIENT_ID` set **explicitly empty** (D-11, A-8). The backend loads the root `.env`, and a variable already present in the process environment, even as an empty string, takes precedence over the `.env` value. So a developer's local `GOOGLE_CLIENT_ID` cannot leak into E2E, and BE-01 treats the empty value as unset.
- **Frontend `webServer` environment:**
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` explicitly empty (D-11)
- **Trace:** FDS §7 (E2E-verifiable criteria); D-11.

---

## 8. Testing Section

Coverage target is **95%** for auth code (FDS frontmatter), checked at Phase 8c after the mocks are deleted. The Full Quality Gate reads it from `frontend/coverage/lcov.info`, `backend/coverage/lcov.info` and `packages/contracts/coverage/lcov.info` (`sonar-project.properties`). TH-01 and TH-02 make `pnpm test:coverage` write those three files. Every source file under the three `src` trees counts, except the two entry points in D-24 (`backend/src/index.ts`, `frontend/src/app/layout.tsx`), which are excluded identically in Sonar (S-01) and in Vitest (TH-01, TH-02). Every test sets up and tears down its own data. Tests never call Google or any network service.

### 8.1 Unit/API items (Unit/API Test agent, `backend/` and `packages/contracts/` tests)

**Test harness:**

- **Backend API and service tests:**
  - Each test runs `createApp` on an ephemeral port and uses global `fetch` (no supertest).
  - Each test or file gets a fresh `:memory:` database with migrations applied by the BE-02 migration function, the same one `index.ts` calls (D-24).
  - A controllable clock, a capturing mailer and a fake Google verifier are injected.
  - Argon2 cost is lowered by test config only.
- **Contract package tests (D-22):** T-UA-01 lives in `packages/contracts/src/**/*.test.ts` and runs under `packages/contracts/vitest.config.ts`. These are pure schema tests with no app, database or backend import. The agent may change only test files and that config under `packages/contracts/`. If a test exposes a defect in the package's non-test source, the agent records it in `defects-unit-api.md` as a conflict and stops, because the frontend also consumes that source (`.ai/prompts/test-build-mode.md`).

#### TH-01 · Coverage reporters for backend and contract package · owner: Unit/API Test agent

- **Files:** `backend/vitest.config.ts`, `packages/contracts/vitest.config.ts`.
- In each file, set `test.coverage.reporter` to a list that includes `"lcov"` and `"text"`. Leave the provider (v8, from the root `@vitest/coverage-v8` 2.1.9, which matches `vitest` 2.1.9 in every workspace) and `reportsDirectory` (default `./coverage`) unchanged, and keep the existing `environment` and `passWithNoTests` settings. No new dependency.
- **Backend only (D-24):** set `test.coverage.exclude` in `backend/vitest.config.ts` to the defaults plus `src/index.ts`, that is `[...coverageConfigDefaults.exclude, "src/index.ts"]` with `coverageConfigDefaults` imported from `vitest/config`. Setting `exclude` replaces Vitest's defaults, so spreading them keeps test files and config files out of the report. `packages/contracts/vitest.config.ts` gets no exclusion.
- Do this before writing the T-UA tests so every coverage run in Phase 8 already emits LCOV.
- **Done when:** `pnpm test:coverage`, run from the repository root, produces `backend/coverage/lcov.info` and `packages/contracts/coverage/lcov.info`. With TH-02, the run produces all three `lcov.info` files that `sonar-project.properties` reads. The text report lists `packages/contracts/src/auth/**` files from the package's own run. The backend text report does not list `src/index.ts` or any `*.test.ts` file, and does list `src/config/env.ts`, `src/db/client.ts` and `src/db/migrate.ts`.
- **Trace:** FDS frontmatter `coverage_target: 95`; `rules/workflow.md` §2 Phase 8c and §7 (Full Quality Gate); `sonar-project.properties` `sonar.javascript.lcov.reportPaths` and `sonar.coverage.exclusions`; D-22; D-24.

| ID      | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Trace                                        |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| T-UA-01 | **Shared rule sets** (tests in `packages/contracts/src/**/*.test.ts` next to the rule sets, run by the package's own `vitest.config.ts`, D-22): one test per FDS §5 message row; first-failing-rule order (`""` → "Password is required.", not the length message); `abcdefg1` → special-character message; `abcdefgh!` → number message; space, underscore and `é` count as special; absent or non-string value → "empty" message; `"   "` name → "Name is required." (D-05); uppercase email passes; login password `x` passes; mismatch → "Passwords do not match."; mismatch still reported alongside a short password; `newPasswordFieldsSchema` works without `token`; empty token → "Token is required."                                                                                                                                                                                                                                                                                                                            | FDS §5, contract §5, D-05, D-06, D-22        |
| T-UA-02 | **Pure functions and adapters:** Google name resolution (trimmed name of 2+ characters; name missing → local part; `" A "` → local part; 1-character local part and no name → `User`); token generator (43-character base64url, deterministic SHA-256 hex that differs from the raw value); signer (HS256, `sub`, `exp = iat + 900`; rejects the wrong secret, an expired token, `alg: none` and other algorithms, a missing `sub`); password hasher (`$argon2id$` prefix, verify true and false); ConsoleMailer logs a line containing the URL; Google verifier with a stubbed library (audience passed, thrown error → invalid, `email_verified` false or missing → invalid, no client ID → invalid without a call)                                                                                                                                                                                                                                                                                                                      | REQ-AUTH-03, FDS §2, §3                      |
| T-UA-03 | **Repositories:** duplicate email → "email taken" result rather than an exception; `google_id` uniqueness; the check constraint rejects a row with neither credential; find-by-hash returns null when unknown; revoke-all touches only that user; invalidate-unused leaves used tokens' `used_at` unchanged; a failure midway through reset-password rolls back the hash, the token and the refresh tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | FDS §3, architecture Transactions            |
| T-UA-04 | **Register and login services:** register creates an `email` account with lowercase email, an argon2id hash, a null Google ID and only a public user returned, stores a hashed refresh token, and creates no profile row; duplicate email (same case, different case, Google-created account, simulated race) → `EmailAlreadyExistsError`; login succeeds case-insensitively; unknown email, wrong password and Google-only account give the identical `InvalidCredentialsError`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | REQ-AUTH-01, REQ-AUTH-02                     |
| T-UA-05 | **Google service:** existing Google ID signs in without writes; an email account with a null Google ID is linked (provider stays `email`, hash kept, `updatedAt` bumped); a different Google ID → `InvalidGoogleTokenError` with the row unchanged; unknown email creates a `google` account with a null hash and the resolved name; verifier failure or `email_verified` false → error and no user; an uppercase token email matches; the create-race falls back to linking (D-14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REQ-AUTH-03                                  |
| T-UA-06 | **Refresh, current user and logout services:** a valid refresh rotates (old token revoked, new token stored with `now + 7 d`, new raw value differs); a rotated, expired (clock + 7 d), unknown or missing token → `UnauthenticatedError`; a deleted user → `UnauthenticatedError`; the current user is returned, an unknown id → `UnauthenticatedError`; logout revokes a valid token and resolves for unknown, missing or already-revoked tokens; **concurrency (A-1):** two refreshes with the same token started together (`Promise.all`) → exactly one succeeds, the other → `UnauthenticatedError`, and exactly one new refresh-token row exists                                                                                                                                                                                                                                                                                                                                                                                     | REQ-AUTH-06, FDS §3 Rotation                 |
| T-UA-07 | **Password reset service:** unknown email → generic result, no token row, mailer not called; a known email → one hashed token row at `now + 30 min` and a mailer URL `<FRONTEND_ORIGIN>/reset-password?token=<raw>` whose hash matches the row; a second request invalidates the first token; a Google-only account gets a token; reset with a valid token replaces the hash (old password fails, new one works), marks the token used and revokes **all** of the user's refresh tokens (seed several); a Google-only account gets a password with provider still `google` and can then log in; reuse, 30 minutes or later, unknown and superseded tokens → `InvalidResetTokenError`; no session is issued; **concurrency (A-1):** two resets with the same token and different passwords started together (`Promise.all`) → exactly one succeeds, the other → `InvalidResetTokenError`, and only the winner's password logs in                                                                                                            | REQ-AUTH-05                                  |
| T-UA-08 | **API tests, per operation** (contract §6): success status and exact body shape; the refresh token is absent from every JSON body; every declared error status and `code`; `fieldErrors` holds the FDS messages verbatim, one per field; missing fields → "required" messages; malformed JSON → `400 VALIDATION_ERROR` with empty `fieldErrors`; login failure bodies for the three cases are deep-equal; forgot-password bodies for registered and unregistered emails are byte-identical; `/google` with the fake verifier covers new, link, conflict and unverified; `/google` with Google unconfigured → 401 (D-08); a forced unexpected error → `500 INTERNAL_ERROR` with no stack; an unknown route → `404 NOT_FOUND`                                                                                                                                                                                                                                                                                                                | FDS §6, contract §3, §6                      |
| T-UA-09 | **Cookie and session API flows:** `Set-Cookie` attributes exactly as contract §4 (no `Secure` outside production, `Secure` with `NODE_ENV=production`); refresh with a cookie → 200 and a different cookie value; replaying the old cookie → 401 and the cookie cleared; no cookie → 401 and cleared; logout → 200 and cleared, then `/refresh` with the old cookie → 401; logout without a cookie → 200; after a reset, every previously issued refresh cookie → 401, the new password logs in and the old one fails; a reset token after the clock advances 30 minutes → `400 INVALID_RESET_TOKEN`                                                                                                                                                                                                                                                                                                                                                                                                                                       | FDS §3, REQ-AUTH-05, REQ-AUTH-06, AC12, AC13 |
| T-UA-10 | **`requireAuth`, CORS and regression:** `/me` with a valid Bearer → 200 user; no header, `Basic` scheme, garbage, another secret, or expired (clock) → `401 UNAUTHENTICATED`; a test-only route behind `requireAuth` receives `userId` equal to the JWT `sub`; preflight from `FRONTEND_ORIGIN` → 204 with the exact origin, credentials `true` and `Authorization` allowed; **regression:** `GET /health` is unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | REQ-AUTH-08, FDS §3 CORS, AC15               |
| T-UA-11 | **Config and database bootstrap (D-24):** `config/env.ts` through its exported function with an env object: missing `JWT_SECRET`, and one of 31 characters, each give an error whose message names `JWT_SECRET` and the rule, while 32 characters pass; with `NODE_ENV=production`, `GOOGLE_CLIENT_ID` missing or empty → an error naming it; outside production, missing or empty `GOOGLE_CLIENT_ID` → valid config with Google unconfigured (empty counts as unset, A-8); defaults `FRONTEND_ORIGIN` = `http://localhost:3000`, `DATABASE_PATH` = `data/app.db`, `PORT` = 4000, and explicit values override them. `db/client.ts` on a path inside a fresh temporary directory whose parent directory does not exist yet: the parent directory and the database file are created, `PRAGMA foreign_keys` is 1 and `PRAGMA journal_mode` is `wal`; the temporary directory is removed afterwards. `db/migrate.ts`: its exported migration function, run on a fresh database, creates `users`, `refresh_tokens` and `password_reset_tokens` | FDS §2, §3, REQ-AUTH-03 (D-08), D-24         |

### 8.2 Component/E2E items (UI/E2E Test agent, `frontend/` and `e2e/`)

**Component tests** use Vitest, React Testing Library and jsdom with `fireEvent`. They mock `features/auth/api/auth-api.ts` (or `lib/api-client.ts` for fetcher tests), `next/navigation` and `@react-oauth/google` with `vi.mock`.

#### TH-02 · Coverage reporters for the frontend · owner: UI/E2E Test agent

- **Files:** `frontend/vitest.config.ts`.
- Set `test.coverage.reporter` to a list that includes `"lcov"` and `"text"`. Leave the provider (v8, root `@vitest/coverage-v8` 2.1.9) and `reportsDirectory` (default `./coverage`) unchanged, and keep the existing plugins, alias, `environment`, `setupFiles` and `passWithNoTests` settings. No new dependency.
- **Exclusion (D-24):** set `test.coverage.exclude` to `[...coverageConfigDefaults.exclude, "src/app/layout.tsx"]`, with `coverageConfigDefaults` imported from `vitest/config`, so Vitest's default exclusions for test and config files stay in place.
- Do this before writing the T-UI component tests so every coverage run in Phase 8 already emits LCOV.
- **Done when:** `pnpm test:coverage`, run from the repository root, produces `frontend/coverage/lcov.info`. With TH-01, the run produces all three `lcov.info` files that `sonar-project.properties` reads. The frontend text report does not list `src/app/layout.tsx` or any `*.test.tsx` file, and does list `src/lib/env.ts`, `src/app/providers.tsx` and the route pages and layouts.
- **Trace:** FDS frontmatter `coverage_target: 95`; `rules/workflow.md` §2 Phase 8c and §7 (Full Quality Gate); `sonar-project.properties` `sonar.javascript.lcov.reportPaths` and `sonar.coverage.exclusions`; D-24.

| ID      | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Trace                                                                                                       |
| :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| T-UI-01 | **Auth card and mode:** a missing or unknown `mode` → Sign In; `signup` → Sign Up; the overlay buttons push `?mode=…`; a mode change clears the hidden form's values and errors; the hidden form is `aria-hidden` and `inert`; the overlay heading, text and button are correct per mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | REQ-AUTH-01, 02, behavior §1–2, AC1                                                                         |
| T-UI-02 | **Sign-up form:** each FDS §5 row appears inline (empty name, 1-character name, empty email, bad email, empty password, 7 characters, no digit, no special character, empty confirm, mismatch); space and underscore count as special; no call when invalid; pending disables the button; success → establish and `/dashboard`; 409 → email-exists toast; network or 500 → sign-up-failed toast; server `fieldErrors` shown inline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | REQ-AUTH-01, FDS §5, behavior §3, AC2–4                                                                     |
| T-UI-03 | **Sign-in form:** empty email, bad email and empty password → inline, no call; a weak password is accepted client-side; pending disables; `INVALID_CREDENTIALS` → inline "Invalid email or password" and the shake class on both inputs, **no refresh call**; network or 500 → sign-in-failed toast; success → `/dashboard`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | REQ-AUTH-02, behavior §4, AC6, AC7                                                                          |
| T-UI-04 | **Password input:** the toggle flips `type`, `aria-label` and `aria-pressed`; the sign-up fields toggle independently; the toggle does not submit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | REQ-AUTH-04, AC5                                                                                            |
| T-UI-05 | **Google button:** no client ID → the fallback renders and clicking it shows the unavailable toast; a script-load error → same; the error callback (dismissal) → no toast, no navigation, no form change; success sends `{ token: credential }`; `INVALID_GOOGLE_TOKEN` or 500 → failed toast; success → `/dashboard`; pending disables the form submit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REQ-AUTH-03, behavior §5, AC8, AC9                                                                          |
| T-UI-06 | **Forgot dialog:** opens with the title; invalid or empty email → inline, no call; pending disables; success → server message and BACK TO SIGN IN, which closes; failure → inline error with the form open and the value kept; Escape closes and focus returns to the trigger; an outside click (pointer down on the overlay) closes it; the "Close" control closes it; reopening shows an empty request step (A-5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | REQ-AUTH-05 Step 1, behavior §6, AC11                                                                       |
| T-UI-07 | **Reset card:** a missing token → invalid-link state with a link to `/auth` and no call; strength and match messages; success → toast and `replace('/auth?mode=signin')` without establishing a session; **starting from an authenticated session** (provider established with a token and user), success → status `unauthenticated`, the token store is empty, the logout operation is not called, then the toast and `replace('/auth?mode=signin')` (B-1, D-12); `INVALID_RESET_TOKEN` → invalid-link state; `VALIDATION_ERROR` → inline; 500 → inline reset-failed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | REQ-AUTH-05 Step 2, behavior §6, §8, AC12, D-12                                                             |
| T-UI-08 | **Session provider:** restore success → authenticated with the token in memory; 401 → unauthenticated; network or 500 → unauthenticated with no toast; two concurrent refreshes → **one** request; renewal fires at `expiresIn − 60 s` (fake timers); a failed renewal → session cleared and `/auth`; `localStorage` and `sessionStorage` `setItem` spies never receive the token; **handler registration (D-23):** with `lib/api-client.ts` mocked, the provider calls `registerSessionHandlers` once on mount with its `refreshSession` and `expireSession`, and calls the returned unregister function on unmount; the registered `refreshSession` resolves `true` and establishes on success, `false` on failure without clearing; the registered `expireSession` clears the session and calls `replace('/auth')`                                                                                                                                                                                                                                                                                                                                                                          | REQ-AUTH-06, behavior §7, D-09, D-23                                                                        |
| T-UI-09 | **API fetcher (D-23):** handlers are registered as fakes through `registerSessionHandlers`, never by rendering the provider. Credentials included on every request; Bearer attached when the token store holds a token; a protected 401 `UNAUTHENTICATED` → the fake `refreshSession` called once, then one retry carrying the new token from the store; fake `refreshSession` resolving `false` → `onSessionExpired` called once and the original 401 returned, no retry; the retry also 401 → `onSessionExpired` called once, the 401 returned, no second refresh and no loop; **no handlers registered → the 401 returned unchanged, no refresh**; after unregistering, the same; the seven public and cookie operations are never retried, and a 401 on them never calls either handler                                                                                                                                                                                                                                                                                                                                                                                                    | REQ-AUTH-06 Renew, contract §7, D-23                                                                        |
| T-UI-10 | **Guards and root:** protected: loading → loader with no children and no redirect; unauthenticated → `replace('/auth')`; authenticated → children; guest-only: authenticated → `replace('/dashboard')`, loading → loader, not the form; root redirects per status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | REQ-AUTH-07, AC14                                                                                           |
| T-UI-11 | **Logout, dashboard placeholder and toast:** logout calls the API, clears the token and the query cache, then `/auth`; logout still clears and redirects when the API rejects; the placeholder shows the name and Sign out; toast variants, auto-dismiss (fake timers), manual close and de-duplication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REQ-AUTH-06 End, REQ-AUTH-07, FDS §5                                                                        |
| T-UI-18 | **Error mapping (unit, A-4):** `auth-error.ts` (FE-04) and the `auth-api.ts` response mapping (INT-03), with `lib/api-client.ts` mocked. For **each of the eight operations** (contract §7): every declared success status → the success result; every declared error status and `code` → its union variant (for example `login` 401 `INVALID_CREDENTIALS` → invalid credentials, `resetPassword` 400 `INVALID_RESET_TOKEN` → invalid reset token, 400 `VALIDATION_ERROR` → field errors with `fieldErrors` passed through); **a `VALIDATION_ERROR` with no key for a field on the submitting form → "unexpected" (A-4)**, tested with an empty `fieldErrors` map and with a map holding only `token` (for example `resetPassword` with the reset form's fields); every **undeclared** outcome → "unexpected": a declared status with an undeclared `code` (for example `register` 401 `UNAUTHENTICATED`, `login` 409), an undeclared status (for example 404 `NOT_FOUND`, 403), any `5xx` including 500 `INTERNAL_ERROR`, any error from `logout` (it declares none), and a malformed error body; a network failure (fetch rejects) → "unexpected" for every operation                        | FDS §5 Generic Failure, §6; contract §1 (undeclared outcomes), §2.5, §7                                     |
| T-UI-20 | **Config, providers, pages and layouts (D-24):** `lib/env.ts` (with `vi.stubEnv` and a fresh module import per case): `NEXT_PUBLIC_API_BASE_URL` unset → `http://localhost:4000` (D-19), set → that value; `NEXT_PUBLIC_GOOGLE_CLIENT_ID` unset or empty → no client ID (Google unavailable), set → that value. `app/providers.tsx`: renders children, and a probe child can reach the QueryClient, toast, Google availability and auth contexts, with Auth innermost, so the order is QueryClient → Toast → Google availability → Auth. `app/page.tsx`: renders the root guard (loader while loading, then the redirect per status). `app/auth/page.tsx`: shows the full-page loader as the Suspense fallback, then the auth card in the mode taken from the `mode` query parameter. `app/reset-password/page.tsx`: Suspense fallback, then the reset card with the `token` query parameter, and the invalid-link state with no call when it is missing. `app/(protected)/layout.tsx`: wraps its children in the protected guard (unauthenticated → `replace('/auth')`, authenticated → children). `app/(protected)/dashboard/page.tsx`: renders the placeholder with the session user's name | FDS frontmatter `coverage_target: 95`, REQ-AUTH-03 (client ID), REQ-AUTH-05 Step 2, REQ-AUTH-07, D-19, D-24 |

**E2E** uses Playwright against the real backend with `data/e2e-test.db` and the INT-07 environment. Each test uses a unique email.

| ID      | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Trace                       |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| T-UI-12 | **Mode and URL:** `/auth` → Sign In; SIGN UP changes the URL to `?mode=signup` without a reload; Back returns to Sign In with fields cleared; a deep link to `?mode=signup` works                                                                                                                                                                                                                                                                                              | AC1, behavior §1–2          |
| T-UI-13 | **Sign-up journeys:** happy path → `/dashboard` with the name; duplicate email → the "An account with this email already exists." toast; empty, weak and mismatched submissions → inline messages with **no** request to `/signup`; a malformed email (for example `user@`) in the real browser → the inline "Enter a valid email address." appears, no native validation tooltip blocks it, and **no** request to `/signup` (A-2, `noValidate`); each eye toggle flips `type` | AC2–AC5                     |
| T-UI-14 | **Sign-in and session:** happy path → `/dashboard`, `refresh_token` cookie is `httpOnly`, no token in Web Storage; wrong password and unknown email both show exactly "Invalid email or password"; reloading `/dashboard` stays there and `/auth` is never visited; a `/me` call intercepted to return `401 UNAUTHENTICATED` → refresh, retry, still on `/dashboard`                                                                                                           | AC6, AC7, AC10, REQ-AUTH-06 |
| T-UI-15 | **Logout and guards:** Sign out → `/auth`; `/dashboard` afterwards → `/auth`, and a reload stays signed out; signed-out `/dashboard` and `/` → `/auth`; signed-in `/auth` → `/dashboard`                                                                                                                                                                                                                                                                                       | AC13, AC14                  |
| T-UI-16 | **Password reset (browser-reachable parts, D-10):** the dialog shows the same generic message for a registered and an unregistered email; Escape closes it and focus returns to the link; `/reset-password` without a token, and `?token=bogus` after submitting valid passwords, both show "This reset link is invalid or has expired." with a working `/auth` link                                                                                                           | AC11, REQ-AUTH-05           |
| T-UI-17 | **Google (D-11):** the Google control is present on both panels; clicking it with Google unconfigured shows "Google sign-in is unavailable."                                                                                                                                                                                                                                                                                                                                   | REQ-AUTH-03, AC8 (UI part)  |

### 8.3 Regression and housekeeping

- **T-UI-19 · `e2e/smoke.spec.ts` update** · owner: UI/E2E Test agent (A-9). `/` now redirects, so the smoke test must land on `/auth` and assert the "Sign in to FinTrack" heading instead of "Expense Tracker". **Trace:** REQ-AUTH-07 (root route).
- **`GET /health`** is unchanged (T-UA-10).
- **Tailwind `primary` token** is unchanged (checked at Phase 6; FE-01 is additive only).
- **Other features:** none exist yet. `requireAuth`, `ErrorBody` and the `(protected)` group are the reuse points, covered by T-UA-10 and T-UI-10.

---

## 9. Spec Traceability

### 9.1 Requirements → tasks and tests

| Requirement / section                      | Setup / Backend                                                                                | Frontend                                 | Integration           | Tests                                                                                                                     |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| FDS §2 Approved libraries                  | S-01, BE-05                                                                                    | FE-09                                    | —                     | T-UA-02                                                                                                                   |
| FDS §3 Data model                          | BE-02, BE-06                                                                                   | —                                        | —                     | T-UA-03                                                                                                                   |
| FDS §3 Session model, cookie, CORS         | BE-05, BE-07, BE-10, BE-13, BE-14                                                              | FE-10                                    | INT-02                | T-UA-06, T-UA-09, T-UA-10, T-UI-08, T-UI-09, T-UI-14                                                                      |
| REQ-AUTH-01 Sign Up                        | BE-03, BE-08, BE-13                                                                            | FE-06, FE-07                             | INT-03, INT-04        | T-UA-01, T-UA-04, T-UA-08, T-UI-01, T-UI-02, T-UI-13                                                                      |
| REQ-AUTH-02 Sign In                        | BE-08, BE-13                                                                                   | FE-06, FE-08                             | INT-03, INT-04        | T-UA-04, T-UA-08, T-UI-01, T-UI-03, T-UI-14                                                                               |
| REQ-AUTH-03 Google SSO                     | BE-01, BE-05, BE-09, BE-13                                                                     | FE-01, FE-09                             | INT-03, INT-07        | T-UA-02, T-UA-05, T-UA-08, T-UA-11, T-UI-05, T-UI-17, T-UI-20                                                             |
| REQ-AUTH-04 Password toggle                | —                                                                                              | FE-02, FE-07, FE-08, FE-13               | —                     | T-UI-04, T-UI-13                                                                                                          |
| REQ-AUTH-05 Forgot / Reset                 | BE-05, BE-06, BE-11, BE-13                                                                     | FE-12, FE-13                             | INT-03, INT-06        | T-UA-07, T-UA-08, T-UA-09, T-UI-06, T-UI-07, T-UI-16                                                                      |
| REQ-AUTH-06 Session lifecycle              | BE-07, BE-10, BE-13                                                                            | FE-10 (D-23), FE-14                      | INT-02 (D-23), INT-03 | T-UA-06, T-UA-09, T-UI-08, T-UI-09, T-UI-11, T-UI-14, T-UI-15                                                             |
| REQ-AUTH-07 Route guard, placeholder, root | —                                                                                              | FE-11, FE-14                             | —                     | T-UI-10, T-UI-11, T-UI-15, T-UI-19, T-UI-20 (D-13: the other five protected routes are verified by their owning features) |
| REQ-AUTH-08 `requireAuth`                  | BE-03, BE-12, BE-13                                                                            | —                                        | INT-02                | T-UA-10, T-UI-09                                                                                                          |
| FDS §5 Validation rules and messages       | BE-03, BE-04                                                                                   | FE-04, FE-05, FE-07, FE-08, FE-12, FE-13 | INT-04                | T-UA-01, T-UA-08, T-UI-02, T-UI-03, T-UI-13                                                                               |
| FDS §5 Generic failure feedback            | BE-04                                                                                          | FE-03, FE-04, FE-07–FE-10, FE-12, FE-13  | INT-03                | T-UI-02, T-UI-03, T-UI-05–T-UI-08, T-UI-18                                                                                |
| FDS §6 API and error responses             | BE-03, BE-04, BE-13                                                                            | FE-04, FE-05                             | INT-02, INT-03        | T-UA-08, T-UI-18                                                                                                          |
| FDS `coverage_target: 95` (Phase 8c)       | S-01, BE-01, BE-02, BE-14 (D-24: two excluded entry points); BE-03 (D-22: package-owned tests) | FE-01, FE-11 (D-24)                      | —                     | TH-01, TH-02, T-UA-01, T-UA-11, T-UI-20                                                                                   |
| behavior §1–2 Routes, sliding panel        | —                                                                                              | FE-06                                    | —                     | T-UI-01, T-UI-12                                                                                                          |
| behavior §3–5 Sign up, sign in, Google     | BE-08, BE-09                                                                                   | FE-07, FE-08, FE-09                      | INT-03                | T-UI-02, T-UI-03, T-UI-05, T-UI-13, T-UI-14, T-UI-17                                                                      |
| behavior §6 Forgot / reset                 | BE-11                                                                                          | FE-12, FE-13                             | INT-03                | T-UI-06, T-UI-07, T-UI-16                                                                                                 |
| behavior §7–8 Session and guards           | BE-10                                                                                          | FE-10, FE-11                             | INT-02                | T-UI-08, T-UI-09, T-UI-10, T-UI-14, T-UI-15                                                                               |
| Visuals                                    | —                                                                                              | FE-01, FE-02, FE-06, FE-13               | —                     | Phase 6 checklist (§6)                                                                                                    |

### 9.2 Acceptance criteria → verifying tests

| #    | FDS §7 acceptance criterion                                                 | Verified by                                 |
| :--- | :-------------------------------------------------------------------------- | :------------------------------------------ |
| AC1  | Sliding switch reflected in `/auth?mode=…` (default signin)                 | T-UI-01, T-UI-12                            |
| AC2  | Register with valid data → `/dashboard`                                     | T-UA-04, T-UA-08, T-UI-02, T-UI-13          |
| AC3  | Existing email → 409 toast                                                  | T-UA-04, T-UA-08, T-UI-02, T-UI-13          |
| AC4  | Inline validation errors                                                    | T-UA-01, T-UI-02, T-UI-03, T-UI-13          |
| AC5  | Eye toggle on both password fields                                          | T-UI-04, T-UI-13                            |
| AC6  | Sign in → refresh cookie and in-memory access token                         | T-UA-09, T-UI-08, T-UI-14                   |
| AC7  | Sign-in failure never reveals email existence or Google-only                | T-UA-04, T-UA-08, T-UI-03, T-UI-14          |
| AC8  | Google sign-in links an existing email, creates for an unknown one          | T-UA-05, T-UA-08, T-UI-05, T-UI-17 (D-11)   |
| AC9  | Dismissing the Google popup changes nothing                                 | T-UI-05                                     |
| AC10 | Reload while signed in restores the session without showing sign-in         | T-UI-08, T-UI-10, T-UI-14                   |
| AC11 | Same forgot-password response for all emails; registered email logs the URL | T-UA-02, T-UA-07, T-UA-08, T-UI-06, T-UI-16 |
| AC12 | Valid reset link works once, expires after 30 minutes, and ends sessions    | T-UA-07, T-UA-09, T-UI-07, T-UI-16 (D-10)   |
| AC13 | Logout revokes; later refresh with the old cookie → 401                     | T-UA-06, T-UA-09, T-UI-11, T-UI-15          |
| AC14 | Protected routes → `/auth`; `/auth` when signed in → `/dashboard`           | T-UI-10, T-UI-15                            |
| AC15 | Protected API → `401 UNAUTHENTICATED` without a valid Bearer                | T-UA-10                                     |

---

## 10. Status for Plan Review

- **Blocking items:** none. The fragments did not conflict on any route, status, code or payload. The open questions both fragments raised were resolved above, each with its basis (§1 and `contract.md` §10). None of them required inventing a requirement the FDS does not imply.
- **For the developer at the Approval Gate:** confirm the starred decisions D-01, D-02, D-03, D-05, D-10, D-11, D-13, D-22, D-23 and D-24.
- **Superseded inputs:** once this plan exists, `fragments/frontend.md` and `fragments/backend.md` are history only (`rules/workflow.md` §6 rule 5).
