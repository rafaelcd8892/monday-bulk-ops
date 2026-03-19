Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Purpose

Mass-edit tool for Monday.com boards. Separate from case-pipeline (read-only dashboard) to keep concerns isolated.

## Safety

- `bun run plan` = dry-run, never mutates
- `bun run execute` = dry-run by default, requires `--confirm` to apply
- All mutations are logged to `logs/*.jsonl` with old/new values

## Project Overview

This project is a **careful bulk-update utility for Monday.com**.

Its purpose is to:

- read items from a **source board**
- identify corresponding items in a **target board**
- copy data from source fields into target fields
- perform updates **only when the target field is empty**
- leave any non-empty target value completely untouched

This tool must behave conservatively. The default posture of the codebase is:

> **Do not overwrite existing data.**
>  
> If there is ambiguity, mismatch, incomplete mapping, or uncertainty about field state, skip the update and log the reason.

This is not a generic sync engine. It is a **guarded fill-in-missing-data script**.

---

## Core Business Rule

For each mapped field:

- If the target field is empty, and the source field has a usable value, update it.
- If the target field already has a value, do nothing.
- If the source field is empty, do nothing.
- If the script cannot confidently determine emptiness or item matching, do nothing and log it.

The tool should be biased toward **skipping** rather than risking bad writes.

---

## Critical Safety Principles

### 1. Never overwrite non-empty target values
This is the most important rule in the entire project.

A target value counts as non-empty if it contains any meaningful data according to the column type.

The script must not treat the following as automatically empty without explicit column-type logic:

- `""`
- `null`
- `{}`
- `[]`
- placeholder display strings
- mirrored/display-only derived values
- partially structured values

Emptiness must be evaluated through a dedicated helper per field type where possible.

---

### 2. Prefer false negatives over false positives
If the script is unsure whether a field is empty, it must assume:

- **not safe to update**
- skip the field
- log the uncertainty

A missed update is acceptable.
A wrong overwrite is not acceptable.

---

### 3. Dry-run first
The script should support a dry-run mode that:

- performs all reads
- calculates all proposed updates
- writes nothing
- outputs a detailed report of:
  - matched items
  - skipped items
  - candidate updates
  - reasons for each decision

No real write mode should be used until dry-run output looks correct.

---

### 4. Explicit mapping only
Never infer mappings loosely.

All of the following must be defined explicitly:

- source board ID
- target board ID
- item matching strategy
- source column ID -> target column ID mapping
- supported column types for each mapping

No “best guess” mapping logic should exist in production code.

---

### 5. Log every decision
For every item pair and field pair, the script should record one of these outcomes:

- `UPDATED`
- `SKIPPED_TARGET_NOT_EMPTY`
- `SKIPPED_SOURCE_EMPTY`
- `SKIPPED_NO_MATCH`
- `SKIPPED_AMBIGUOUS_MATCH`
- `SKIPPED_UNSUPPORTED_COLUMN_TYPE`
- `SKIPPED_VALIDATION_FAILED`
- `ERROR`

The log must make it possible to audit exactly what happened.

---

## Intended Use Case

This project exists to support mass backfilling between Monday boards where:

- data already exists in one board
- another board contains corresponding items
- some target fields are still blank
- only blank target fields should be populated

Typical scenario:

- a connected relationship exists between two boards
- mirrored information is visible or logically associated
- we want to backfill missing data into writable fields
- we do **not** want to disturb records already curated by staff

---

## Non-Goals

This project is **not** intended to:

- keep two boards fully synchronized bidirectionally
- replace Monday automations entirely
- overwrite stale values automatically
- “clean up” inconsistent data by force
- guess human intent
- update fields based on approximate similarity unless explicitly configured

---

## Matching Strategy

Item matching must be deterministic.

Preferred strategies, in order:

1. explicit linked item ID
2. stored external key / unique identifier
3. exact normalized text key
4. never use fuzzy matching unless the project explicitly adds and validates it

If multiple target items match one source item, treat it as ambiguous:

- skip update
- log `SKIPPED_AMBIGUOUS_MATCH`

If no item matches:

- skip update
- log `SKIPPED_NO_MATCH`

---

## Column Update Policy

Only update fields that are explicitly supported and validated.

For each mapped column, define:

- source column ID
- target column ID
- source type
- target type
- emptiness rule
- transform rule
- write serializer

Each column type must have careful handling.

### Example safe categories
Depending on implementation maturity, these are the most realistic candidates for early support:

- text
- long text
- numbers
- date
- status
- email
- phone
- dropdown
- people (only if clearly structured and validated)

### High-risk / special-care categories
These should be treated very cautiously:

- mirror columns
- formula columns
- rollup-style derived values
- connect boards columns
- dependency columns
- subitems-related fields
- files
- timeline
- unsupported custom structures

If a field is read-only, derived, mirrored, or not safely writable through the API, skip it.

---

## Mirror Column Rule

Mirror columns are especially sensitive.

Important principle:

- mirror values may be useful as **read/reference/input**
- mirror columns themselves are often **not writable**
- the actual write may need to happen on a different writable column in the target board

Therefore:

- never assume a mirrored column can be written to directly
- verify whether the target field is a real writable column
- if business logic depends on mirror-derived values, document exactly how they are interpreted

If the architecture involves:
- reading mirrored data from one location
- writing into a different writable field

that must be explicit in configuration.

---

## Empty Value Detection

Empty detection must be column-aware.

### General rule
A field is only “empty” if it contains no meaningful user-entered value.

### Suggested helper
Use a dedicated function like:

`isTargetFieldEmpty(columnType, rawValue, textValue) => boolean`

This helper should contain explicit logic per supported type.

### Examples
These are examples only; actual implementation must verify Monday API response shape.

- Text / Long Text:
  - empty if null, missing, or trimmed string is empty
- Number:
  - empty if null or missing
  - zero is **not** empty
- Date:
  - empty if missing date object / null
- Status:
  - empty if no label selected
- Dropdown:
  - empty if no selected values
- Email:
  - empty if missing both address and text
- Phone:
  - empty if missing number
- People:
  - empty if no persons assigned

Do not use a single universal emptiness check for all columns.

---

## Source Value Validation

A source value must be considered usable before update.

Use a helper like:

`hasUsableSourceValue(columnType, rawValue, textValue) => boolean`

Examples:

- whitespace-only text is not usable
- malformed email is not usable
- invalid date format is not usable
- unrecognized status label should not be written blindly
- structurally invalid JSON payloads should be rejected

If source data is present but invalid:
- skip update
- log `SKIPPED_VALIDATION_FAILED`

---

## Execution Order

Recommended execution flow:

1. Load configuration
2. Validate board IDs and column mappings
3. Fetch source items
4. Fetch target items
5. Resolve item matches deterministically
6. For each matched item pair:
   - inspect mapped fields
   - determine target emptiness
   - validate source value
   - generate safe update payload only for approved fields
7. In dry-run:
   - print/report all candidate actions
8. In live mode:
   - write only approved field updates
   - capture API response
   - log success/failure per field/item
9. Output final summary

---

## Required Modes

### Dry Run
Must be the default mode unless explicitly disabled.

Dry run should show:

- source item ID
- target item ID
- matched key
- field-by-field decision
- current target value summary
- source value summary
- proposed write payload
- skip reason where applicable

### Live Mode
Live mode should only execute when an explicit flag is passed, for example:

`--execute`

Without that flag, no writes should occur.

---

## Logging Requirements

Logs should be structured and easy to inspect.

At minimum, each log record should include:

- timestamp
- source board ID
- target board ID
- source item ID
- target item ID
- source column ID
- target column ID
- decision
- reason
- old target summary
- source summary
- new value summary (if updated)

Preferred formats:

- JSONL for machine-readable audit
- readable console summary for operator review

---

## Error Handling Philosophy

Errors must fail safely.

If a write for one item fails:

- do not crash the entire run unless configured to do so
- log the error
- continue with the next item where safe

If authentication, schema discovery, or mapping validation fails:

- stop the run
- do not attempt partial writes

Never continue into live updates with broken configuration.

---

## Idempotency

The script should be idempotent in practice.

Running it multiple times should not create harmful repeated effects because:

- once a target field has been filled, it should no longer qualify as empty
- non-empty values are never overwritten
- unmatched or invalid records remain skipped

This behavior is mandatory.

---

## Configuration Requirements

Configuration should be externalized, not hardcoded in business logic.

Suggested configuration fields:

- `sourceBoardId`
- `targetBoardId`
- `matchKeySourceColumnId`
- `matchKeyTargetColumnId`
- `columnMappings`
- `supportedColumnTypes`
- `dryRun`
- `batchSize`
- `rateLimitDelayMs`

Each column mapping should ideally define:

- `sourceColumnId`
- `targetColumnId`
- `sourceType`
- `targetType`
- `allowUpdateOnlyIfTargetEmpty: true`
- optional transform function name

---

## API Discipline

Monday.com API usage must be careful and minimal.

Guidelines:

- avoid unnecessary writes
- batch reads where possible
- throttle when needed
- respect rate limits
- retry transient failures cautiously
- never retry blindly on validation or schema errors

Before live execution, the code should confirm:

- the target column is writable
- the payload format matches the target column type
- the item match is unique

---

## Testing Expectations

This project requires tests for the safety-critical logic.

Minimum test coverage should include:

### Unit tests
- empty detection by column type
- source usability validation
- transformation functions
- match resolution logic
- skip/allow decision engine

### Integration-style tests
- mock Monday API reads
- confirm dry-run emits expected actions
- confirm live mode only writes allowed fields
- confirm non-empty target fields are never updated

### Must-have edge cases
- target contains whitespace
- target contains zero
- target contains partially structured JSON
- source missing
- multiple matches
- unsupported target type
- mirror/read-only target field
- malformed status/date/email payload

---

## Code Style and Architecture

The code should be modular and explicit.

Preferred modules:

- `config`
- `mondayClient`
- `schema`
- `matcher`
- `emptiness`
- `validators`
- `transformers`
- `planner`
- `executor`
- `logger`
- `reporter`

Do not bury business rules inside API-call functions.

Keep the decision logic separate from the transport layer.

---

## Decision Rule Summary

A field may be updated only when **all** of the following are true:

1. source item matched exactly one target item
2. mapping exists explicitly
3. target column is supported and writable
4. target field is confirmed empty
5. source field has usable valid data
6. transform succeeds
7. update payload passes validation

If any one of those fails:
- skip
- log why

---

## Preferred Developer Behavior

When modifying this project, always preserve these priorities:

1. data safety
2. auditability
3. deterministic behavior
4. correctness over convenience
5. explicit configuration over implicit inference
6. skip over guesswork

When in doubt, do less.

---

## What Claude Should Optimize For

When assisting on this repository, optimize for:

- safe update planning
- defensive type handling
- precise emptiness detection
- deterministic matching
- strong logs
- clear dry-run output
- minimal risk of accidental overwrite

Avoid suggestions that make the script “more automatic” at the expense of safety.

Any proposed code that increases write scope, broadens matching, or weakens validation should be treated as suspect unless explicitly justified.

---

## Final Project Principle

This utility exists to fill gaps, not to rewrite history.

Its job is to identify missing target values and backfill them safely from a trusted source.

Anything already populated should be treated as intentionally preserved unless a future version of the project introduces a separate, explicitly authorized overwrite mode.