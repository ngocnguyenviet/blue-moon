# Verification map

- R01 → auth middleware/session/OTP and resident scope → API role/isolation and OTP tests.
- R02 → Housing services and dated histories → overlap/transfer/history tests.
- R03 → billing calculator/snapshots/readings → 28/29/30/31-day independent expected values, rate splits, duplicate/partial publication tests.
- R04 → transaction ledger → partial/duplicate/concurrent payment, overpayment, reversals, writeoff recovery and report reconciliation tests.
- R05 → VNPAY adapter/IPN → HMAC tamper, amount mismatch, repeats/late callbacks; real sandbox requires credentials.
- R06 → outbox/Apps Script → signature/nonce/retry/reminder tests; actual inbox delivery requires allowlisted Gmail setup.
- R07 → report/export/print → ledger reconciliation and XLSX checks.
- R08 → React UI/deployment/seed → build/types, browser QA across three widths and fresh install README.

Technical defaults: Asia/Ho_Chi_Minh business dates, UTC timestamps, integral VND with decimal source measurements, one Node web service serving React; PostgreSQL advisory transaction locks serialize household financial writes. External calls are outside financial transactions.

## Executed evidence — 13 October 2026

`npm test`: **37 passed across 6 files**, with an isolated real PostgreSQL schema for the integration suite.

- **R01:** `integration.test.ts`: first-manager bootstrap, resident data isolation, invalid pagination/sort, OTP cooldown/attempt cap/single use/session invalidation, stale email binding, concurrent manager locks and accountant restrictions. `auth.ts`, `housing.ts`, `bootstrap.ts`, `app.ts` implement these controls. Browser QA on the compiled build completed account provisioning, forced temporary-password change, re-login and local OTP verification into the correct household dashboard.
- **R02:** `domain.test.ts` and `integration.test.ts`: adjacent intervals, transfers, overlapping occupancy refusal, readings bounded by previous/next values. `housing.ts` preserves household IDs and histories.
- **R03:** `domain.test.ts` and `billing.test.ts`: calendar days, half-up rounding, area/person/rate splits, utilities without proration, irrelevant vehicle/headcount boundaries excluded for utilities, leap-February vehicle counts. `integration.test.ts`: missing utility data, partial publication, stale draft rejection/removal, due-date changes on drafts, immutable published snapshot/due and no duplicate generation. Implemented in `billing.ts`.
- **R04:** `integration.test.ts`: targeted payment first, duplicate/concurrent requests, late overpayment credit, simultaneous refunds, paid-fee decrease, source-preserving reversal/refund, write-off/restore bounds and ledger/report equation. `finance.ts` serializes by household. Read-only reconciliation also executed against all 994 seed charges.
- **R05:** `vnpay.test.ts`, `integration.test.ts`: signed fields, forged/merchant/amount mismatch, repeated IPN, late callback and provider payment date. This is a local authenticated callback test, not a real merchant Sandbox test. `vnpay.ts` leaves browser return non-authoritative.
- **R06:** `bridge.test.ts`: tampered/expired/nonfinite envelopes. `apps-script.test.ts`: accepted once, ID payload mismatch, replay, allowlist, quota, ambiguous send. `integration.test.ts`: payment outbox deduplication, settled debt reminder suppression, stale OTP suppression, dispatch lease and stable retry payload. Google services are stubbed; actual Gmail and daily trigger/cold-start tests remain external.
- **R07:** `integration.test.ts`: ledger reconciliation, Vietnamese month boundary, XLSX HTTP response. Compiled-build browser QA downloaded the actual Excel file and generated a receipt PDF with Playwright; its rendered page was inspected. Native print-dialog/printer behavior remains unverified. See [BROWSER_QA.md](BROWSER_QA.md) for artifacts.
- **R08:** Final `npm run build` executed successfully, including type checks and a new compiled server entrypoint check. Fixed the TypeScript output path/start command mismatch, started the compiled server and checked `/api/health` with PostgreSQL. The dedicated local database port is now persistent across restarts. Seed completion and safe rerun were checked on 12 October. Browser iteration results/screenshots are in [BROWSER_QA.md](BROWSER_QA.md), with dates identifying which build was tested. Render/Neon configuration files are preparation; deployment is not yet verified.

No official course grading rubric was supplied. S1/S2 refer to course concepts; detailed scope and technology choices are user decisions, not invented grading rules.
