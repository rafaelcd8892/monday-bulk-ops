# Daily Activity Log

## March 20, 2026

Today I did:
- Discovered and mapped the Jail Intakes board (90 columns) to identify which columns contain useful data for profiles
- Traced the connection chain from Jail Intakes through Appointments to Profiles (133 jail intakes linked to profiles)
- Built and ran a source scan to find which profile fields could be filled from jail intake data
- Filled 210 fields across 91 profiles using jail intake data (mostly detention facility addresses and dates of birth)
- All updates were verified safe — only empty fields were touched, nothing was overwritten

## March 19, 2026

Today I did:
- Audited the Profiles board to identify how many entries had empty columns (1,695 profiles needed backfilling)
- Mapped source columns across 4 appointment boards (R, M, LB, WH) to the corresponding profile fields
- Built normalizers to clean up A Numbers (formatted to XXX-XXX-XXX) and dates of birth (formatted to MM/DD/YYYY)
- Ran a source scan across all appointment boards and resolved conflicts by using the most recent consultation date
- Tested a small batch of 10 profiles to verify updates were correct
- Executed the full backfill: updated 1,272 profiles with 2,029 field writes and zero errors
- All updates only filled empty fields — no existing data was changed

---

## Template

<!--
Copy the section below for each new day. Keep entries simple and non-technical.
-->

## [Date]

Today I did:
-
-
-
