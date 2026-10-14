# Implementation ledger

Approved spec: REQUIREMENTS.md R01–R08 and conversation final plan. Fresh implementation; no earlier demo code. Custom developer implemented UI/seed; root also implemented and fixed source after the user explicitly permitted direct edits when the developer hit quota. Custom web_tester performed browser QA; root completed the remaining checks after the tester reached its usage limit, with authorship and evidence recorded in BROWSER_QA.md.

## Tasks
- [x] Baseline, scaffold, initial PostgreSQL schema and isolated local cluster.
- [x] R01 identity/session/OTP/role scope, private bootstrap and API tests.
- [x] R02 housing histories, overlap and meter validation tests.
- [x] R03 billing/readings/partial publication, immutable published amounts/due dates and tests.
- [x] R04 source-traced ledger, concurrent payment/refund/reversal tests and seed reconciliation.
- [x] R05 VNPAY signature/IPN/query adapter and explicitly labeled local payment simulation; local callback tests.
- [x] R06 transactional outbox, signed Apps Script, replay/quota/ambiguity/lease/reminder tests using Google stubs.
- [x] R07 reports/export/print UI, Vietnamese calendar receipt boundaries and financial reconciliation tests.
- [x] R08 responsive UI, resumable seed, deployment README and Render configuration.
- [x] Final compiled build and local database/server startup checkpoint.
- [x] Local browser QA checkpoint: role navigation, partial simulated payment, onboarding/OTP, Excel, rendered receipt PDF and responsive layouts. Native print-dialog and external integration limits remain documented in [BROWSER_QA.md](BROWSER_QA.md).

## Environment
Node 24 and PostgreSQL 18. Dedicated `.local/pgdata` (ignored), bound to `127.0.0.1:55432`; existing services preserved. The cluster configuration now persists that address and port, so the README startup command also works after a reboot. Three applied migrations. ExcelJS replaces SheetJS; Vitest/Vite and vulnerable transitive packages updated/overridden. `npm audit` on 13 October 2026: 0 reported vulnerabilities, including dev dependencies.

## Executed local verification (13 October 2026)

- `npm test`: 6 files, **37 tests passed**. API/DB tests create and remove a separate random schema; demo data is not reset.
- `npm run build`: passed, including Prisma generation, client type checking, Vite output, server compilation and a syntax/path check of `dist-server/server/index.js`. Vite warns about the single ~550 kB JavaScript chunk (about 154 kB gzip); this is a performance warning, not a failed build.
- Reproduced and fixed a compiled startup failure: TypeScript inferred a different output root from the path used by `npm start`. Explicit server `rootDir` now aligns the emitted file with the startup command; the build checks that entrypoint. Started the compiled server and verified HTTP 200 from `/api/health` with PostgreSQL connected.
- Seed baseline: 30 apartments, 29 households, 994 published charges over six months (162/162/162/168/173/167), 843 payments. QA may add labeled demo transactions later.
- Read-only check on all 994 published charges: assessment = net allocations + written-off amount + outstanding. Global successful mandatory receipts minus refunds minus allocations = credit; all household credits nonnegative. Rechecked on 14 October after the final QA payment: net allocated 252,377,971 VND + credit 20,000 VND = mandatory receipts 252,397,971 VND.
- Rerunning `npm run db:seed` on 12 October: completion marker detected; existing data preserved.
- Browser iteration 1 exposed a stale-list navigation crash; fixed by tying list data to page and user. Iteration 2 verified charge navigation, accountant partial cash receipt, resident simulated payment, temporary-password onboarding, Excel download and three responsive widths. The 13 October compiled build passed follow-up checks for single payment/debt reduction after reload, full new-household/password/OTP onboarding, Excel download, rendered receipt PDF and stable mobile navigation. See [BROWSER_QA.md](BROWSER_QA.md) for precise coverage and remaining limits.
- On 14 October `/api/health` still returned HTTP 200 with PostgreSQL connected. No application source changes were made after the successful build/tests; final changes were evidence and documentation only.

## External verification
User has no external accounts yet. Neon/Render, VNPAY merchant sandbox and Gmail Apps Script must be configured by user. Actual public deployment, real sandbox callback and inbox delivery remain unverified until setup; local demo adapters must be explicitly labeled.

Instructions and source are ready in `docs/DEPLOYMENT.md`, `render.yaml`, `integrations/apps-script/`. `ACCEPTED` only means MailApp accepted the request, not inbox delivery. Ambiguous sends require journal reconciliation before retry, as documented. No payment/refund or SMS money service has been activated.

## Rulings
- Existing scaffold preserved after interrupted execution; tests will cover its existing logic and fail-first tests cover new logic/fixes. No retroactive TDD claim.
- One dedicated project workspace, no git repository yet; no automatic git reset/worktree or unrelated DB changes.
- Integration credentials are not grounds to stop local implementation.
