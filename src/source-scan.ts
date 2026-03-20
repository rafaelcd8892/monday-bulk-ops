/**
 * Phase 2: Source scan + match report.
 *
 * 1. Fetch all profiles (target fields + appointment links)
 * 2. Fetch all appointments from 4 boards (source fields + profile links + consult date)
 * 3. For each profile with empty fields, find best source value (most recent appointment)
 * 4. Output a JSONL report — zero writes
 *
 * Usage: bun src/source-scan.ts
 */

import { mkdirSync, writeFileSync, appendFileSync } from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = "https://api.monday.com/v2";
const PROFILES_BOARD = "8025265377";

const APPOINTMENT_BOARDS = [
  {
    name: "Appointments R",
    id: "7788520205",
    profileLinkCol: "connect_boards4__1",
    fieldMap: {
      dup__of_first_name2__1: "a_number",
      date_of_birth_mkkvs9xh: "date_of_birth",
      country_of_birth__1: "country_of_birth",
      text2: "phone",
      text: "email",
      text0__1: "address",
    },
  },
  {
    name: "Appointments M",
    id: "8025383981",
    profileLinkCol: "connect_boards4__1",
    fieldMap: {
      dup__of_first_name2__1: "a_number",
      date_of_birth_mkmqmrv: "date_of_birth",
      country_of_birth__1: "country_of_birth",
      text2: "phone",
      text: "email",
      text0__1: "address",
    },
  },
  {
    name: "Appointments LB",
    id: "8025389724",
    profileLinkCol: "connect_boards4__1",
    fieldMap: {
      dup__of_first_name2__1: "a_number",
      date_of_birth_mkmqyeaf: "date_of_birth",
      country_of_birth__1: "country_of_birth",
      text2: "phone",
      text: "email",
      text0__1: "address",
    },
  },
  {
    name: "Appointments WH",
    id: "9283837796",
    profileLinkCol: "connect_boards4__1",
    fieldMap: {
      dup__of_first_name2__1: "a_number",
      date_of_birth_mkmqyeaf: "date_of_birth",
      country_of_birth__1: "country_of_birth",
      text2: "phone",
      text: "email",
      text0__1: "address",
    },
  },
];

// Canonical field name → target profile column ID
const TARGET_FIELD_MAP: Record<string, { columnId: string; title: string }> = {
  a_number: { columnId: "text__1", title: "A Number" },
  date_of_birth: { columnId: "text2__1", title: "Date of Birth" },
  country_of_birth: { columnId: "country_of_birth__1", title: "Country of Birth" },
  phone: { columnId: "phone7__1", title: "Phone" },
  email: { columnId: "email__1", title: "E-mail" },
  // Address fills both Mailing Address and Physical Address
  address_mailing: { columnId: "physical_address8__1", title: "Mailing Address" },
  address_physical: { columnId: "text_mkrkrsgj", title: "Physical Address" },
};

const PROFILE_TARGET_COL_IDS = [
  "text__1",          // A Number
  "text2__1",         // Date of Birth
  "country_of_birth__1", // Country of Birth
  "phone7__1",        // Phone
  "email__1",         // E-mail
  "physical_address8__1", // Mailing Address
  "text_mkrkrsgj",    // Physical Address
];

const APPOINTMENTS_LINK_COL = "link_to_r__1";
const CONSULT_DATE_COL = "date3__1";

// ---------------------------------------------------------------------------
// API helpers
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

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface ColumnValue {
  id: string;
  text: string;
  value: string | null;
  linked_item_ids?: string[];
}

interface Item {
  id: string;
  name: string;
  column_values: ColumnValue[];
}

/** A source value from an appointment, tagged with date for conflict resolution */
interface SourceCandidate {
  appointmentId: string;
  appointmentName: string;
  boardName: string;
  consultDate: string | null; // ISO date or null
  values: Record<string, string>; // canonical field → text value
}

/** Per-field decision for the report */
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
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAllBoardItems(
  boardId: string,
  columnIds: string[],
  useBoardRelation: boolean = false
): Promise<Item[]> {
  const all: Item[] = [];
  let cursor: string | null = null;
  const limit = 500;
  const colIds = JSON.stringify(columnIds);

  const boardRelationFragment = useBoardRelation
    ? `... on BoardRelationValue { linked_item_ids }`
    : "";

  const firstQuery = `query {
    boards(ids: [${boardId}]) {
      items_page(limit: ${limit}) {
        cursor
        items {
          id
          name
          column_values(ids: ${colIds}) {
            id
            text
            value
            ${boardRelationFragment}
          }
        }
      }
    }
  }`;

  const firstRes = await gql(firstQuery);
  const firstPage = firstRes.data.boards[0].items_page;
  all.push(...firstPage.items);
  cursor = firstPage.cursor;

  while (cursor) {
    const nextQuery = `query ($cursor: String!) {
      next_items_page(limit: ${limit}, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values(ids: ${colIds}) {
            id
            text
            value
            ${boardRelationFragment}
          }
        }
      }
    }`;

    const nextRes = await gql(nextQuery, { cursor });
    const page = nextRes.data.next_items_page;
    all.push(...page.items);
    cursor = page.cursor;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

function getColText(item: Item, colId: string): string {
  const cv = item.column_values.find(c => c.id === colId);
  return cv?.text?.trim() ?? "";
}

function getLinkedIds(item: Item, colId: string): string[] {
  const cv = item.column_values.find(c => c.id === colId);
  return cv?.linked_item_ids ?? [];
}

function isFieldEmpty(text: string): boolean {
  return !text || text.trim() === "" || text === "null";
}

function isSourceUsable(text: string): boolean {
  return !!text && text.trim() !== "" && text !== "null";
}

function parseConsultDate(item: Item): string | null {
  const cv = item.column_values.find(c => c.id === CONSULT_DATE_COL);
  if (!cv?.value) return null;
  try {
    const parsed = JSON.parse(cv.value);
    return parsed?.date ?? null;
  } catch {
    // Fallback to text
    return cv.text?.trim() || null;
  }
}

async function main() {
  const startTime = Date.now();

  // Step 1: Fetch all profiles
  console.log("Step 1: Fetching all profiles...");
  const profileColIds = [...PROFILE_TARGET_COL_IDS, APPOINTMENTS_LINK_COL];
  const profiles = await fetchAllBoardItems(PROFILES_BOARD, profileColIds, true);
  console.log(`  → ${profiles.length} profiles fetched`);

  // Step 2: Fetch all appointments from all 4 boards
  console.log("\nStep 2: Fetching appointments from all 4 boards...");

  // Map: profileId → SourceCandidate[]
  const profileSources: Map<string, SourceCandidate[]> = new Map();

  for (const board of APPOINTMENT_BOARDS) {
    const sourceColIds = [
      ...Object.keys(board.fieldMap),
      board.profileLinkCol,
      CONSULT_DATE_COL,
    ];

    console.log(`  Fetching ${board.name}...`);
    const items = await fetchAllBoardItems(board.id, sourceColIds, true);
    console.log(`    → ${items.length} appointments`);

    for (const appt of items) {
      const linkedProfileIds = getLinkedIds(appt, board.profileLinkCol);
      if (linkedProfileIds.length === 0) continue;

      const consultDate = parseConsultDate(appt);

      // Collect source values
      const values: Record<string, string> = {};
      for (const [sourceColId, canonicalField] of Object.entries(board.fieldMap)) {
        const text = getColText(appt, sourceColId);
        if (isSourceUsable(text)) {
          values[canonicalField] = text;
        }
      }

      const candidate: SourceCandidate = {
        appointmentId: appt.id,
        appointmentName: appt.name,
        boardName: board.name,
        consultDate,
        values,
      };

      // An appointment can link to multiple profiles (rare but possible)
      for (const profileId of linkedProfileIds) {
        if (!profileSources.has(profileId)) {
          profileSources.set(profileId, []);
        }
        profileSources.get(profileId)!.push(candidate);
      }
    }
  }

  console.log(`\n  → ${profileSources.size} profiles have at least one linked appointment (from appointment side)`);

  // Step 3: Generate report
  console.log("\nStep 3: Generating field-by-field report...\n");

  mkdirSync("reports", { recursive: true });
  const reportPath = `reports/source-scan-${new Date().toISOString().slice(0, 10)}.jsonl`;
  writeFileSync(reportPath, ""); // clear

  // Counters
  const summary = {
    totalProfiles: profiles.length,
    profilesWithLinks: 0,
    profilesWithoutLinks: 0,
    profilesFullyFilled: 0,
    profilesNeedingWork: 0,
    fieldCounts: {} as Record<string, Record<string, number>>,
  };

  // Initialize field counters
  const allFields = [
    "a_number", "date_of_birth", "country_of_birth",
    "phone", "email", "address_mailing", "address_physical",
  ];
  for (const f of allFields) {
    summary.fieldCounts[f] = {
      WILL_UPDATE: 0,
      SKIPPED_TARGET_NOT_EMPTY: 0,
      SKIPPED_SOURCE_EMPTY: 0,
      SKIPPED_NO_LINKED_APPOINTMENTS: 0,
    };
  }

  for (const profile of profiles) {
    const linkedApptIds = getLinkedIds(profile, APPOINTMENTS_LINK_COL);
    const candidates = profileSources.get(profile.id) ?? [];

    // Combine: appointments linked FROM the profile AND appointments linked TO the profile
    // We already have profileSources from the appointment side.
    // Also check profile-side links and see if any appointment we fetched matches.
    // For now, use the appointment-side links as primary (they're more reliable).

    const allCandidates = candidates;
    const hasLinks = allCandidates.length > 0 || linkedApptIds.length > 0;

    if (!hasLinks) {
      summary.profilesWithoutLinks++;
      continue;
    }

    summary.profilesWithLinks++;

    // Sort candidates by consult date descending (most recent first)
    // Null dates go last
    allCandidates.sort((a, b) => {
      if (!a.consultDate && !b.consultDate) return 0;
      if (!a.consultDate) return 1;
      if (!b.consultDate) return -1;
      return b.consultDate.localeCompare(a.consultDate);
    });

    const fields: FieldDecision[] = [];
    let hasAnyUpdate = false;

    // Helper to evaluate a canonical field
    function evaluateField(
      canonicalField: string,
      targetColId: string,
      targetTitle: string
    ): FieldDecision {
      const currentValue = getColText(profile, targetColId);

      if (!isFieldEmpty(currentValue)) {
        return {
          field: canonicalField,
          targetColumnId: targetColId,
          targetTitle,
          currentTargetValue: currentValue,
          decision: "SKIPPED_TARGET_NOT_EMPTY",
          reason: "Target field already has a value",
          sourceValue: null,
          sourceAppointmentId: null,
          sourceBoard: null,
          sourceConsultDate: null,
        };
      }

      if (allCandidates.length === 0) {
        return {
          field: canonicalField,
          targetColumnId: targetColId,
          targetTitle,
          currentTargetValue: "",
          decision: "SKIPPED_NO_LINKED_APPOINTMENTS",
          reason: "No linked appointments found with data",
          sourceValue: null,
          sourceAppointmentId: null,
          sourceBoard: null,
          sourceConsultDate: null,
        };
      }

      // Pick best source: most recent appointment with a usable value
      const sourceField = canonicalField === "address_mailing" || canonicalField === "address_physical"
        ? "address"
        : canonicalField;

      for (const candidate of allCandidates) {
        const val = candidate.values[sourceField];
        if (val && isSourceUsable(val)) {
          return {
            field: canonicalField,
            targetColumnId: targetColId,
            targetTitle,
            currentTargetValue: "",
            decision: "WILL_UPDATE",
            reason: `Source value from ${candidate.boardName} (consult: ${candidate.consultDate ?? "unknown"})`,
            sourceValue: val,
            sourceAppointmentId: candidate.appointmentId,
            sourceBoard: candidate.boardName,
            sourceConsultDate: candidate.consultDate,
          };
        }
      }

      return {
        field: canonicalField,
        targetColumnId: targetColId,
        targetTitle,
        currentTargetValue: "",
        decision: "SKIPPED_SOURCE_EMPTY",
        reason: "No linked appointment has a usable value for this field",
        sourceValue: null,
        sourceAppointmentId: null,
        sourceBoard: null,
        sourceConsultDate: null,
      };
    }

    // Evaluate each target field
    fields.push(evaluateField("a_number", "text__1", "A Number"));
    fields.push(evaluateField("date_of_birth", "text2__1", "Date of Birth"));
    fields.push(evaluateField("country_of_birth", "country_of_birth__1", "Country of Birth"));
    fields.push(evaluateField("phone", "phone7__1", "Phone"));
    fields.push(evaluateField("email", "email__1", "E-mail"));
    fields.push(evaluateField("address_mailing", "physical_address8__1", "Mailing Address"));
    fields.push(evaluateField("address_physical", "text_mkrkrsgj", "Physical Address"));

    for (const f of fields) {
      summary.fieldCounts[f.field][f.decision] =
        (summary.fieldCounts[f.field][f.decision] ?? 0) + 1;
      if (f.decision === "WILL_UPDATE") hasAnyUpdate = true;
    }

    if (hasAnyUpdate) summary.profilesNeedingWork++;
    else summary.profilesFullyFilled++;

    const report: ProfileReport = {
      profileId: profile.id,
      profileName: profile.name,
      linkedAppointmentCount: allCandidates.length,
      fields,
    };

    appendFileSync(reportPath, JSON.stringify(report) + "\n");
  }

  // Step 4: Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`${"=".repeat(70)}`);
  console.log(`SOURCE SCAN REPORT`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\nTotal profiles: ${summary.totalProfiles}`);
  console.log(`With linked appointments: ${summary.profilesWithLinks}`);
  console.log(`Without linked appointments: ${summary.profilesWithoutLinks} (skipped)`);
  console.log(`Profiles needing at least one update: ${summary.profilesNeedingWork}`);
  console.log(`Profiles already fully filled: ${summary.profilesFullyFilled}`);

  console.log(`\nPer-field breakdown:\n`);
  console.log(
    `${"Field".padEnd(22)} ${"WILL_UPDATE".padStart(12)} ${"TGT_FILLED".padStart(12)} ${"SRC_EMPTY".padStart(12)} ${"NO_APPTS".padStart(12)}`
  );
  console.log(`${"-".repeat(22)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)}`);

  for (const f of allFields) {
    const c = summary.fieldCounts[f];
    console.log(
      `${TARGET_FIELD_MAP[f]?.title?.padEnd(22) ?? f.padEnd(22)} ${String(c.WILL_UPDATE ?? 0).padStart(12)} ${String(c.SKIPPED_TARGET_NOT_EMPTY ?? 0).padStart(12)} ${String(c.SKIPPED_SOURCE_EMPTY ?? 0).padStart(12)} ${String(c.SKIPPED_NO_LINKED_APPOINTMENTS ?? 0).padStart(12)}`
    );
  }

  console.log(`\nFull report written to: ${reportPath}`);
  console.log(`Completed in ${elapsed}s`);
}

main().catch(console.error);
