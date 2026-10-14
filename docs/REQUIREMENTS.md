# BlueMoon — approved baseline

Sources: Pr01/Pr03 (S1), C7.6 (S2), user decisions on 8–9 October 2026 (U). Earlier demo is reference only. No authoritative grading rubric or deadline supplied. Deliver website, source and README; no invented course reports.

R01 S1/U: manager, accountant, resident; household representative login by unique email or phone; temporary password, verified email, OTP reset. Resident sees own household only.
R02 S1/U: one building, 30 demo apartments; dated occupancy, headcount, vehicle registration. End date exclusive. Household/account survive transfer. Vacant intervals incur no fees.
R03 S1/S2/U: fixed/area/person/vehicle monthly fees prorated by actual dates; electricity/water one configured rate and actual readings, transfer readings; draft then partial publication, no duplicates; integer VND round half up per charge. Voluntary campaigns create no debt.
R04 S2/U: partial cash/external transfer and sandbox payment; oldest due mandatory debt consumes household credit; late overpayment becomes credit. Manager-only audited cancellations/adjustments/writeoffs/restorations/refunds. Preserve ledger and old household debt.
R05 U: VNPAY sandbox, authenticated duplicate-safe IPN; return URL never proves payment. No real money or refund API.
R06 S2/U: real email only to allowlisted test recipients through signed Gmail Apps Script; OTP priority; durable retries, daily reminders at due-3/due+1, catch-up. SMS simulation explicitly labeled.
R07 S1/S2/U: month/quarter assessments, receipts, outstanding, adjustments, refunds, credits, writeoffs; Excel export and print/PDF.
R08 U: Vietnamese responsive UI 390/768/1440; original moon/building SVG, free dusk apartment photo, transparent login; light staff tables and resident app layout. Render free + Neon PostgreSQL; README and fictional 6-month seed.

Out: multi-building, personal population registers, landlord liability, maintenance, full accounting, penalties, broken/replaced meters, actual SMS/payment/refund APIs. External credentials must be user-owned and never committed. Missing credentials are unmet integration verification, not a successful integration.
