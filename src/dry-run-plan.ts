/**
 * Phase 3: Dry-run plan.
 *
 * Reads the source scan JSONL report and generates exact API payloads
 * for every proposed update. Outputs a plan file for human review.
 *
 * Zero writes to Monday.com.
 *
 * Usage: bun src/dry-run-plan.ts
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { normalizeANumber, normalizeDateOfBirth } from "./normalizers";

// ---------------------------------------------------------------------------
// Types (matching source-scan output)
// ---------------------------------------------------------------------------

interface FieldDecision {
  field: string;
  targetColumnId: string;
  targetTitle: string;
  currentTargetValue: string;
  decision: string;
  reason: string;
  sourceValue: string | null;
  sourceAppointmentId: string | null;
  sourceBoard: string | null;
  sourceConsultDate: string | null;
}

interface ProfileReport {
  profileId: string;
  profileName: string;
  linkedAppointmentCount: number;
  fields: FieldDecision[];
}

// ---------------------------------------------------------------------------
// Payload builders per column type
// ---------------------------------------------------------------------------

/**
 * Build the Monday.com column_values payload for a single field update.
 *
 * Most target columns are `text` type — just a plain string.
 * `email__1` is `email` type — needs {"email": "...", "text": "..."}.
 */
function buildColumnPayload(
  targetColumnId: string,
  sourceValue: string,
  field: string
): { columnId: string; payload: unknown; valid: boolean; reason?: string; normalizedValue?: string } {
  let value = sourceValue.trim();
  let normNote: string | undefined;

  // Apply normalizers for specific fields
  if (field === "a_number") {
    const result = normalizeANumber(value);
    if (result.rejected) {
      return { columnId: targetColumnId, payload: null, valid: false, reason: `A Number rejected: ${result.reason}` };
    }
    if (result.changed) {
      normNote = result.reason;
      value = result.value;
    }
  }

  if (field === "date_of_birth") {
    const result = normalizeDateOfBirth(value);
    if (result.rejected) {
      return { columnId: targetColumnId, payload: null, valid: false, reason: `DOB rejected: ${result.reason}` };
    }
    if (result.changed) {
      normNote = result.reason;
      value = result.value;
    }
  }

  if (targetColumnId === "email__1") {
    if (!value.includes("@")) {
      return { columnId: targetColumnId, payload: null, valid: false, reason: `Invalid email format: "${value}"` };
    }
    return {
      columnId: targetColumnId,
      payload: { email: value, text: value },
      valid: true,
      reason: normNote,
      normalizedValue: value,
    };
  }

  if (!value) {
    return { columnId: targetColumnId, payload: null, valid: false, reason: "Source value is empty after trimming" };
  }

  return {
    columnId: targetColumnId,
    payload: value,
    valid: true,
    reason: normNote,
    normalizedValue: value,
  };
}

// ---------------------------------------------------------------------------
// Plan types
// ---------------------------------------------------------------------------

interface PlannedFieldUpdate {
  field: string;
  targetColumnId: string;
  targetTitle: string;
  currentTargetValue: string;
  sourceValue: string;
  normalizedValue?: string;
  normalizationNote?: string;
  sourceAppointmentId: string;
  sourceBoard: string;
  sourceConsultDate: string | null;
  apiPayload: unknown;
}

interface SkippedField {
  field: string;
  targetColumnId: string;
  targetTitle: string;
  decision: string;
  reason: string;
  currentTargetValue: string;
  sourceValue: string | null;
}

interface PlannedProfileUpdate {
  profileId: string;
  profileName: string;
  linkedAppointmentCount: number;
  updates: PlannedFieldUpdate[];
  skipped: SkippedField[];
  combinedPayload: Record<string, unknown>; // what change_multiple_column_values will receive
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Find the most recent report
  const reportPath = "reports/source-scan-2026-03-19.jsonl";
  console.log(`Reading source scan report: ${reportPath}\n`);

  const lines = readFileSync(reportPath, "utf-8").trim().split("\n");
  const profiles: ProfileReport[] = lines.map(l => JSON.parse(l));

  console.log(`Loaded ${profiles.length} profile reports\n`);

  mkdirSync("reports", { recursive: true });
  const planPath = `reports/dry-run-plan-${new Date().toISOString().slice(0, 10)}.jsonl`;
  const summaryPath = `reports/dry-run-summary-${new Date().toISOString().slice(0, 10)}.txt`;

  const planned: PlannedProfileUpdate[] = [];

  // Counters
  let totalUpdates = 0;
  let totalNormalized = 0;
  let totalSkipped = 0;
  let totalValidationFailed = 0;
  let profilesWithUpdates = 0;
  const fieldUpdateCounts: Record<string, number> = {};
  const fieldSkipCounts: Record<string, Record<string, number>> = {};

  for (const profile of profiles) {
    const updates: PlannedFieldUpdate[] = [];
    const skipped: SkippedField[] = [];

    for (const field of profile.fields) {
      if (field.decision === "WILL_UPDATE" && field.sourceValue) {
        // Build payload and validate
        const result = buildColumnPayload(field.targetColumnId, field.sourceValue, field.field);

        if (result.valid) {
          updates.push({
            field: field.field,
            targetColumnId: field.targetColumnId,
            targetTitle: field.targetTitle,
            currentTargetValue: field.currentTargetValue,
            sourceValue: field.sourceValue,
            normalizedValue: result.normalizedValue,
            normalizationNote: result.reason,
            sourceAppointmentId: field.sourceAppointmentId!,
            sourceBoard: field.sourceBoard!,
            sourceConsultDate: field.sourceConsultDate,
            apiPayload: result.payload,
          });
          fieldUpdateCounts[field.field] = (fieldUpdateCounts[field.field] ?? 0) + 1;
          if (result.reason) totalNormalized++;
        } else {
          skipped.push({
            field: field.field,
            targetColumnId: field.targetColumnId,
            targetTitle: field.targetTitle,
            decision: "SKIPPED_VALIDATION_FAILED",
            reason: result.reason!,
            currentTargetValue: field.currentTargetValue,
            sourceValue: field.sourceValue,
          });
          totalValidationFailed++;
          const key = field.field;
          if (!fieldSkipCounts[key]) fieldSkipCounts[key] = {};
          fieldSkipCounts[key]["SKIPPED_VALIDATION_FAILED"] =
            (fieldSkipCounts[key]["SKIPPED_VALIDATION_FAILED"] ?? 0) + 1;
        }
      } else {
        skipped.push({
          field: field.field,
          targetColumnId: field.targetColumnId,
          targetTitle: field.targetTitle,
          decision: field.decision,
          reason: field.reason,
          currentTargetValue: field.currentTargetValue,
          sourceValue: field.sourceValue,
        });
        const key = field.field;
        if (!fieldSkipCounts[key]) fieldSkipCounts[key] = {};
        fieldSkipCounts[key][field.decision] =
          (fieldSkipCounts[key][field.decision] ?? 0) + 1;
      }
    }

    // Build the combined payload for change_multiple_column_values
    const combinedPayload: Record<string, unknown> = {};
    for (const u of updates) {
      combinedPayload[u.targetColumnId] = u.apiPayload;
    }

    if (updates.length > 0) {
      profilesWithUpdates++;
      totalUpdates += updates.length;
    }
    totalSkipped += skipped.length;

    planned.push({
      profileId: profile.profileId,
      profileName: profile.profileName,
      linkedAppointmentCount: profile.linkedAppointmentCount,
      updates,
      skipped,
      combinedPayload,
    });
  }

  // Write JSONL plan (only profiles with updates)
  const planLines = planned
    .filter(p => p.updates.length > 0)
    .map(p => JSON.stringify(p))
    .join("\n");
  writeFileSync(planPath, planLines + "\n");

  // Write human-readable summary
  const summaryLines: string[] = [];
  summaryLines.push("=".repeat(70));
  summaryLines.push("DRY-RUN PLAN SUMMARY");
  summaryLines.push("=".repeat(70));
  summaryLines.push("");
  summaryLines.push(`Generated: ${new Date().toISOString()}`);
  summaryLines.push(`Source report: ${reportPath}`);
  summaryLines.push("");
  summaryLines.push(`Total profiles analyzed: ${profiles.length}`);
  summaryLines.push(`Profiles with updates planned: ${profilesWithUpdates}`);
  summaryLines.push(`Total field updates: ${totalUpdates}`);
  summaryLines.push(`Total field skips: ${totalSkipped}`);
  summaryLines.push(`Validation failures: ${totalValidationFailed}`);
  summaryLines.push(`Values normalized: ${totalNormalized}`);
  summaryLines.push("");
  summaryLines.push("-".repeat(70));
  summaryLines.push("UPDATES PER FIELD");
  summaryLines.push("-".repeat(70));
  summaryLines.push("");

  const allFields = [
    "a_number", "date_of_birth", "country_of_birth",
    "phone", "email", "address_mailing", "address_physical",
  ];
  const fieldTitles: Record<string, string> = {
    a_number: "A Number",
    date_of_birth: "Date of Birth",
    country_of_birth: "Country of Birth",
    phone: "Phone",
    email: "E-mail",
    address_mailing: "Mailing Address",
    address_physical: "Physical Address",
  };

  summaryLines.push(`${"Field".padEnd(22)} ${"Updates".padStart(10)}`);
  summaryLines.push(`${"-".repeat(22)} ${"-".repeat(10)}`);
  for (const f of allFields) {
    summaryLines.push(`${(fieldTitles[f] ?? f).padEnd(22)} ${String(fieldUpdateCounts[f] ?? 0).padStart(10)}`);
  }

  summaryLines.push("");
  summaryLines.push("-".repeat(70));
  summaryLines.push("SAMPLE UPDATES (first 20 profiles)");
  summaryLines.push("-".repeat(70));
  summaryLines.push("");

  const samples = planned.filter(p => p.updates.length > 0).slice(0, 20);
  for (const p of samples) {
    summaryLines.push(`Profile: ${p.profileName} (ID: ${p.profileId})`);
    summaryLines.push(`  Linked appointments: ${p.linkedAppointmentCount}`);
    for (const u of p.updates) {
      if (u.normalizationNote) {
        summaryLines.push(`  ✓ ${u.targetTitle}: "" → "${u.normalizedValue}" (was: "${u.sourceValue}")`);
        summaryLines.push(`    Normalized: ${u.normalizationNote}`);
      } else {
        summaryLines.push(`  ✓ ${u.targetTitle}: "" → "${u.sourceValue}"`);
      }
      summaryLines.push(`    Source: ${u.sourceBoard}, appt ${u.sourceAppointmentId} (${u.sourceConsultDate ?? "no date"})`);
    }
    for (const s of p.skipped) {
      if (s.decision === "SKIPPED_TARGET_NOT_EMPTY") {
        summaryLines.push(`  · ${s.targetTitle}: KEEP "${s.currentTargetValue}"`);
      }
    }
    summaryLines.push("");
  }

  summaryLines.push("-".repeat(70));
  summaryLines.push("API PAYLOAD SAMPLE (first 5)");
  summaryLines.push("-".repeat(70));
  summaryLines.push("");

  const payloadSamples = planned.filter(p => p.updates.length > 0).slice(0, 5);
  for (const p of payloadSamples) {
    summaryLines.push(`Profile ${p.profileId} (${p.profileName}):`);
    summaryLines.push(`  Board: 8025265377`);
    summaryLines.push(`  Item: ${p.profileId}`);
    summaryLines.push(`  column_values: ${JSON.stringify(p.combinedPayload, null, 2)}`);
    summaryLines.push("");
  }

  writeFileSync(summaryPath, summaryLines.join("\n") + "\n");

  // Console output
  console.log(summaryLines.join("\n"));
  console.log(`\nPlan JSONL: ${planPath}`);
  console.log(`Summary:    ${summaryPath}`);
}

main();
