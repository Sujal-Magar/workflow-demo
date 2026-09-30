# Plan Review: Authentication and Identity (`auth`) v1.0.0

Reviewed: `plan.md` (revision 3) and `contract.md` (revision 3), against `fds.md`, `behavior.md`, `visuals/` (both PNGs viewed), `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`. `rules/domain-glossary.md` does not exist. Review date: 2026-09-25. Independent review from scratch; no prior review files or fragments were read.

## Verdict: PASS

There are no Blocking Findings. Eleven Advisory Findings are listed for the developer to confirm or fold into Build; none needs a new plan version.

## Repo facts verified directly

- `packages/contracts/src/index.ts` is `export {}`; `main` is `./src/index.ts` (TypeScript source). Backend `tsconfig` is CommonJS with `moduleResolution: node`, `rootDir ./src`. `frontend/next.config.mjs` has no `transpilePackages`.
- Root `.env` holds only `PORT`, `FRONTEND_ORIGIN`, `DATABASE_PATH`. `.env.local`, `*.db` and `test-results/` are git-ignored. There is no `data/` directory. `pnpm-workspace.yaml` has `allowBuilds` for `better-sqlite3` and `esbuild` only.
- `backend/package.json` has no `@ts-rest/core`; `frontend/package.json` has `@ts-rest/react-query` but no `@ts-rest/core`. The plan's P0-1 claim is correct.
- `e2e/smoke.spec.ts` asserts the `h1` "Expense Tracker" and runs only under `pnpm test:e2e` (not `pnpm test`). `backend/src/index.ts` matches the plan's section 5.1 description (inline CORS with `Content-Type` only, `/health`, listen at import).
- Visual measurements in plan 6.4 match the PNGs: 2x captures of 1440 px, card 800 x 600, overlay 320 px, form panel 480 px. Overlay sits left for signup and right for signin. The visuals show placeholders `Name`, `Email`, `Password`, `Confirm Password`, the centered `Forgot your password?` link between the password field and the button, and a grey "G".
- Probe (copy under the scratchpad only, nothing written to the repo):
  - `tsc --noEmit` and `tsc` in a backend copy that imports a TypeScript-source `@expense-tracker/contracts` (ts-rest core and zod) type-check with no TS6059 `rootDir` error, and `tsx` runs it. The plan's BE-01 approach is buildable.
  - A Playwright `webServer.command` of the form `mkdir -p test-results && <server> > test-results/backend.log 2>&1` produced a log readable from a test, on a first and a second run. D-19 is feasible.

## Blocking Findings

None.

## Advisory Findings

1. **Normalization owner is not stated in one place (plan 5.6, contract 3, D-8).** The contract schemas (BE-01) plainly trim `name` and `email`; lowercasing is stated only in `loginWithGoogle` (5.6), while `register`, `login` and `requestPasswordReset` do not say who lowercases. TU-03 and TU-04 (service-level, case-differing duplicates and login) imply the service does it. Build should lowercase in one place (service, via a single helper) and have `requestPasswordReset` and `login` use it.
2. **`requireAuth` shape and TU-09 probe route (BE-12, TU-09).** `requireAuth` "calls `SessionService.verifyAccessToken`" and is "exported for other features", but the plan does not say it is a factory taking the service. TU-09 needs a "probe route in the test app" while `createApp(deps)` (BE-03) has no route-extension hook, and Test Build Mode may not change production code. Decide the signature (for example `createRequireAuth(sessionService)`) so the test can build its own tiny Express app. TU-18 already covers the same behaviour through `GET /auth/me`.
3. **Unset `GOOGLE_CLIENT_ID` has two owners (5.6 vs BE-08 vs TU-05).** The `loginWithGoogle` bullet says the service throws for an unset `GOOGLE_CLIENT_ID`, but services never read `process.env`. BE-08 places it in `GoogleAuthLibraryVerifier` ("not configured means rejection"). TU-05 lists it at service level. Treat it as an adapter rejection, and let the service test use a fake verifier that rejects.
4. **Malformed JSON on the two body-less operations (contract 1, 4.4, 4.6, 5; plan BE-03).** `express.json()` is global, so a syntactically broken body sent to `refreshSession` or `logout` yields `400 VALIDATION_ERROR`. The contract says these operations accept no body or `{}` and lists only `401` for refresh and "always 200" for logout, without covering a malformed body. Extremely unlikely from the real client; state the behaviour (or skip the parser on those two paths) in Build.
5. **D-19 log path and reuse detection.** The backend `webServer` has `cwd: "backend"`, so `mkdir -p test-results` creates `backend/test-results` unless written `../test-results`. The plan says "repo root". Use `../test-results/backend.log` in the command, and have TE-13's reader use the repo-root path. Also say how the test detects that a server was reused (for example an env flag set only when `CI` is unset and a port probe succeeds) so the "skipped when reused" rule is executable.
6. **P0-1 rationale vs 6.3.1.** P0-1 justifies `@ts-rest/core` partly by an "imperative refresh path" using `initClient`, while 6.3.1 says there is a single ts-rest React Query client and "no parallel client". The React Query client exposes non-hook calls, so a second client is unnecessary. Align the wording so Build does not create two clients.
7. **`@ts-rest/core` as a new direct dependency of `backend/` and `frontend/`.** It is in `rules/tech-stack.md` and already a dependency of `packages/contracts`, so it is not a new library, but FDS section 2 says no other new libraries are approved and CLAUDE.md requires explicit approval. D-1 and section 10 do not list it for the gate. Add it to D-1 so the developer confirms it explicitly.
8. **D-12 and sign-in email trimming have no test.** D-12 (inline sign-in error clears on next submit and when the forgot dialog opens) and 6.6 (email trimmed before validation and submit) have no matching TC or task wording; TC-45 covers only the sign-up name. Add a short case to TC-10 or TC-13 and TC-9.
9. **`next/font/google` needs network at build time (FE-01, INT-07).** Loading Poppins and Inter through `next/font/google` makes `next build` (and E2E `next dev`) fetch fonts from Google; in an offline or sandboxed CI, `pnpm build` (an INT-07 gate) can fail. No fallback is stated. Consider a documented fallback (system font stack) if the fetch fails.
10. **Production run path is not in scope but worth noting (BE-01, BE-05).** Backend `tsc` build would emit a `require("@expense-tracker/contracts")` that resolves to a TypeScript-source `main`, and SQL migrations under `src/db/migrations` are not copied to `dist`. There is no `start` script today, and dev, tests and typecheck were verified to work, so nothing fails in this feature. Record it for whichever feature adds a production start.
11. **Traceability matrix gap (section 2).** The "FDS section 5 generic failure feedback" row omits TC-20 (Google backend failure) and TC-32 (session restore network/5xx), which are the tests that actually cover those two rows. Cosmetic.

## Checklist Summary

1. Coverage: PASS. Every REQ-AUTH-01..08, FDS sections 2, 3, 5 and 6, and each behavior.md section (routes, sliding panel, sign-up, sign-in, Google, forgot/reset, restore/renew/logout, guard) maps to at least one task.
2. Traceability: PASS. Every P0, BE, FE and INT task has a Cites column naming a REQ, FDS section or a cited decision.
3. Cross-section consistency: PASS. Checked task against test, decision against task, and contract against plan: the Authorization-only-on-Bearer rule and retry rule (contract 1, 7; plan 6.3.1; TC-35, TC-36), cookie set, rotate and clear table (contract 6; BE-12; TU-14, TU-15), body and non-object body handling (contract 1, 5, R3; BE-03; TU-13, TU-21), CORS methods (contract 6; BE-04; TU-21), D-22 transaction boundaries (5.5, 5.6; TU-25), D-23 sequencing (sections 4, 9), D-24 env delivery (P0-3; TE-14, TE-16) and D-25 timing agree. Only the small imprecisions in Advisory 1 to 6 remain.
4. Rule compliance: PASS. Layering is intact (services free of Express, repositories single-table, Drizzle and native libraries behind ports and repositories). No `any`, kebab-case files, contract-derived types only. The libraries are those of FDS section 2 plus the already-listed `@ts-rest/core` (Advisory 7). The contract's `401` and `500` codes are FDS-mandated or covered by the conventions' 500 rule.
5. Testability: PASS. Concrete TU-01..26, TC-1..46 and TE-1..17 cover every requirement, including race, atomicity, log-safety, mobile-layout and Google-availability cases.
6. Ambiguity carried forward: PASS. Spec gaps are written down as decisions D-4..D-8, D-11..D-16, D-24..D-27 and contract R1..R11 and A1..A5 (trim rules, copy for unshown fields, mobile layout, logo asset, login email 400, `INTERNAL_ERROR`, DB path, protected-route acceptance, sequencing deviation). No unresolved decision was found.
7. API Contract completeness: PASS. All eight operations, request and response shapes, status codes, error catalogue, cookie and CORS attributes, and the reset link are specified. It is technology-agnostic prose (no ts-rest, Zod or SDL syntax) and stays consistent with the FDS sections 5 and 6 messages and codes.
