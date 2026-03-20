/**
 * Jail Intakes → Profiles executor.
 *
 * Safety:
 *   - Reads the jail dry-run plan JSONL
 *   - Re-fetches each profile's current values before writing (double-gate)
 *   - Only writes fields that are STILL empty at execution time
 *   - Logs every decision to logs/*.jsonl
 *   - Rate-limited to respect Monday API limits
 *
 * Usage:
 *   bun src/jail-batch-execute.ts                        # dry-run (default), no writes
 *   bun src/jail-batch-execute.ts --limit 10             # dry-run, first 10 profiles
 *   bun src/jail-batch-execute.ts --limit 10 --confirm   # LIVE, first 10 profiles
 *   bun src/jail-batch-execute.ts --confirm              # LIVE, all profiles
 */

import { readFileSync, mkdirSync, appendFileSync } from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = "https://api.monday.com/v2";
const PROFILES_BOARD = "8025265377";
const MUTATION_DELAY_MS = 400;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

// ---------------------------------------------------------------------------
// Types
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
  combinedPayload: Record<string, unknown>;
}

interface LogEntry {
  timestamp: string;
  profileId: string;
  profileName: string;
  targetColumnId: string;
  field: string;
  decision: string;
  reason: string;
  oldValue: string;
  sourceValue: string | null;
  newValue: string | null;
  sourceAppointmentId: string | null;
  sourceBoard: string | null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function getToken(): string {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN is not set.");
  return token;
}

async function gql(query: string, variables?: Record<string, unknown>): Promise<any> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken(),
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Monday API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json;
}

/** Re-fetch a single item's current column values — the double-gate safety check. */
async function fetchCurrentValues(
  itemId: string,
  columnIds: string[]
): Promise<Record<string, string>> {
  const query = `query {
    items(ids: [${itemId}]) {
      column_values(ids: ${JSON.stringify(columnIds)}) {
        id
        text
        value
      }
    }
  }`;

  const res = await gql(query);
  const item = res.data.items?.[0];
  if (!item) throw new Error(`Item ${itemId} not found`);

  const result: Record<string, string> = {};
  for (const cv of item.column_values) {
    result[cv.id] = cv.text?.trim() ?? "";
  }
  return result;
}

async function writeColumnValues(
  itemId: string,
  columnValues: Record<string, unknown>
): Promise<void> {
  const query = `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }`;

  await gql(query, {
    boardId: PROFILES_BOARD,
    itemId,
    columnValues: JSON.stringify(columnValues),
  });
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

let logPath: string;

function initLog() {
  mkdirSync("logs", { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const mode = confirm ? "LIVE" : "DRYRUN";
  logPath = `logs/jail-batch-${mode}-${ts}.jsonl`;
}

function log(entry: LogEntry) {
  appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  initLog();

  const planPath = `reports/jail-dry-run-plan-${new Date().toISOString().slice(0, 10)}.jsonl`;
  console.log(`Reading plan: ${planPath}`);

  const lines = readFileSync(planPath, "utf-8").trim().split("\n");
  const allPlanned: PlannedProfileUpdate[] = lines.map(l => JSON.parse(l));

  const batch = allPlanned.slice(0, limit);

  console.log(`\nMode: ${confirm ? "🔴 LIVE — WRITES ENABLED" : "🟢 DRY-RUN — no writes"}`);
  console.log(`Source: Jail Intakes`);
  console.log(`Profiles in plan: ${allPlanned.length}`);
  console.log(`Profiles in this batch: ${batch.length}`);
  console.log(`Log file: ${logPath}\n`);

  if (confirm) {
    console.log("Starting in 5 seconds... (Ctrl+C to abort)");
    await Bun.sleep(5000);
  }

  let totalWritten = 0;
  let totalSkippedDoubleGate = 0;
  let totalErrors = 0;
  let profilesUpdated = 0;

  for (let i = 0; i < batch.length; i++) {
    const plan = batch[i];
    const columnIds = plan.updates.map(u => u.targetColumnId);

    process.stdout.write(`[${i + 1}/${batch.length}] ${plan.profileName} (${plan.profileId})...`);

    // Double-gate: re-fetch current values
    let currentValues: Record<string, string>;
    try {
      currentValues = await fetchCurrentValues(plan.profileId, columnIds);
    } catch (err) {
      console.log(` ERROR fetching current values: ${err}`);
      for (const u of plan.updates) {
        log({
          timestamp: new Date().toISOString(),
          profileId: plan.profileId,
          profileName: plan.profileName,
          targetColumnId: u.targetColumnId,
          field: u.field,
          decision: "ERROR",
          reason: `Failed to fetch current values: ${err}`,
          oldValue: "",
          sourceValue: u.sourceValue,
          newValue: null,
          sourceAppointmentId: u.sourceAppointmentId,
          sourceBoard: u.sourceBoard,
        });
      }
      totalErrors++;
      continue;
    }

    // Filter: only write fields that are STILL empty
    const safePayload: Record<string, unknown> = {};
    const fieldsWritten: string[] = [];
    const fieldsSkipped: string[] = [];

    for (const u of plan.updates) {
      const currentText = currentValues[u.targetColumnId] ?? "";
      const isEmpty = !currentText || currentText === "null";

      if (isEmpty) {
        safePayload[u.targetColumnId] = u.apiPayload;
        fieldsWritten.push(u.targetTitle);
        log({
          timestamp: new Date().toISOString(),
          profileId: plan.profileId,
          profileName: plan.profileName,
          targetColumnId: u.targetColumnId,
          field: u.field,
          decision: confirm ? "UPDATED" : "WILL_UPDATE",
          reason: `Target confirmed empty at execution time`,
          oldValue: "",
          sourceValue: u.normalizedValue ?? u.sourceValue,
          newValue: String(typeof u.apiPayload === "object" ? JSON.stringify(u.apiPayload) : u.apiPayload),
          sourceAppointmentId: u.sourceAppointmentId,
          sourceBoard: u.sourceBoard,
        });
      } else {
        fieldsSkipped.push(u.targetTitle);
        totalSkippedDoubleGate++;
        log({
          timestamp: new Date().toISOString(),
          profileId: plan.profileId,
          profileName: plan.profileName,
          targetColumnId: u.targetColumnId,
          field: u.field,
          decision: "SKIPPED_DOUBLE_GATE",
          reason: `Target field no longer empty: "${currentText}"`,
          oldValue: currentText,
          sourceValue: u.normalizedValue ?? u.sourceValue,
          newValue: null,
          sourceAppointmentId: u.sourceAppointmentId,
          sourceBoard: u.sourceBoard,
        });
      }
    }

    if (Object.keys(safePayload).length === 0) {
      console.log(` all fields already filled (double-gate caught ${fieldsSkipped.length})`);
      continue;
    }

    // Execute write
    if (confirm) {
      try {
        await writeColumnValues(plan.profileId, safePayload);
        totalWritten += fieldsWritten.length;
        profilesUpdated++;
        console.log(` ✓ wrote ${fieldsWritten.length} fields: ${fieldsWritten.join(", ")}${fieldsSkipped.length > 0 ? ` (skipped ${fieldsSkipped.length} via double-gate)` : ""}`);
      } catch (err) {
        console.log(` ERROR writing: ${err}`);
        totalErrors++;
        for (const u of plan.updates) {
          if (safePayload[u.targetColumnId]) {
            log({
              timestamp: new Date().toISOString(),
              profileId: plan.profileId,
              profileName: plan.profileName,
              targetColumnId: u.targetColumnId,
              field: u.field,
              decision: "ERROR",
              reason: `Write failed: ${err}`,
              oldValue: "",
              sourceValue: u.normalizedValue ?? u.sourceValue,
              newValue: null,
              sourceAppointmentId: u.sourceAppointmentId,
              sourceBoard: u.sourceBoard,
            });
          }
        }
      }
    } else {
      totalWritten += fieldsWritten.length;
      profilesUpdated++;
      console.log(` [dry-run] would write ${fieldsWritten.length} fields: ${fieldsWritten.join(", ")}${fieldsSkipped.length > 0 ? ` (would skip ${fieldsSkipped.length} via double-gate)` : ""}`);
    }

    // Rate limit between mutations
    if (confirm && i < batch.length - 1) {
      await Bun.sleep(MUTATION_DELAY_MS);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`JAIL EXECUTION SUMMARY (${confirm ? "LIVE" : "DRY-RUN"})`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Profiles processed: ${batch.length}`);
  console.log(`Profiles updated: ${profilesUpdated}`);
  console.log(`Total fields written: ${totalWritten}`);
  console.log(`Fields skipped (double-gate): ${totalSkippedDoubleGate}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Log: ${logPath}`);
}

main().catch(console.error);
