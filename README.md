# Monday.com Bulk Ops

A safe, one-time bulk backfill tool for Monday.com boards. Fills in missing data on the Profiles board by reading from appointment and jail intake boards — without ever overwriting existing values.

## What it does

Many profile entries were missing information (A Number, Date of Birth, Country of Birth, Phone, Email, Address) that should have been auto-populated when appointments were created. This tool fixes those gaps by:

1. Reading data from source boards (Appointments R, M, LB, WH, and Jail Intakes)
2. Matching source entries to their corresponding profiles
3. Filling **only empty** profile fields with the matched data
4. Leaving any already-filled fields completely untouched

## Safety

- **Dry-run by default** — nothing is written unless you explicitly pass `--confirm`
- **Double-gate check** — every field is verified empty both at planning time and again at write time
- **Full audit trail** — every decision (update, skip, error) is logged to `logs/*.jsonl`
- **Idempotent** — running the same script twice has no effect because filled fields are skipped

## Usage

Requires [Bun](https://bun.sh) and a `MONDAY_API_TOKEN` in `.env`.

### Appointment backfill

```bash
# Phase 1: Scan source data
bun src/source-scan.ts

# Phase 2: Generate dry-run plan
bun src/dry-run-plan.ts

# Phase 3: Execute (dry-run first, then live)
bun src/batch-execute.ts --limit 10          # dry-run, first 10
bun src/batch-execute.ts --limit 10 --confirm # live, first 10
bun src/batch-execute.ts --confirm            # live, all
```

### Jail intake backfill

```bash
# Phase 1: Scan jail intake data (traces Jail → Appointment → Profile chain)
bun src/jail-source-scan.ts

# Phase 2: Generate dry-run plan
bun src/jail-dry-run-plan.ts

# Phase 3: Execute
bun src/jail-batch-execute.ts --limit 10          # dry-run, first 10
bun src/jail-batch-execute.ts --limit 10 --confirm # live, first 10
bun src/jail-batch-execute.ts --confirm            # live, all
```

### Other utilities

```bash
bun src/audit-profiles.ts     # Audit empty fields on Profiles board
bun src/inspect-formats.ts    # Check A Number and DOB format conventions
bun src/discover-boards.ts    # List all columns on the 5 boards
bun test                      # Run normalizer tests
```

## Boards

| Board | ID | Role |
|---|---|---|
| Profiles | 8025265377 | Target (fields are filled here) |
| Appointments R | 7788520205 | Source |
| Appointments M | 8025383981 | Source |
| Appointments LB | 8025389724 | Source |
| Appointments WH | 9283837796 | Source |
| Jail Intakes | 8094412694 | Source (via appointment chain) |

## Project structure

```
src/
  source-scan.ts          # Appointment → Profile source scan
  dry-run-plan.ts         # Appointment dry-run plan generator
  batch-execute.ts        # Appointment executor
  jail-source-scan.ts     # Jail Intake → Profile source scan
  jail-dry-run-plan.ts    # Jail intake dry-run plan generator
  jail-batch-execute.ts   # Jail intake executor
  normalizers.ts          # A Number and DOB normalization
  normalizers.test.ts     # Tests for normalizers
  audit-profiles.ts       # Profile empty-field audit
  inspect-formats.ts      # Format convention inspector
  discover-boards.ts      # Board column discovery
reports/                  # Scan reports and plans (JSONL + summaries)
logs/                     # Execution audit logs (JSONL)
docs/                     # Board structure documentation
```
