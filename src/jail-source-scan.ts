/**
 * Jail Intakes → Profiles source scan.
 *
 * Traces the chain: Jail Intake → Appointment → Profile
 * Then checks which profile fields are still empty and proposes fills
 * from jail intake data.
 *
 * Zero writes to Monday.com.
 *
 * Usage: bun src/jail-source-scan.ts
 */

import { mkdirSync, writeFileSync, appendFileSync } from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = "https://api.monday.com/v2";
const PROFILES_BOARD = "8025265377";
const JAIL_INTAKES_BOARD = "8094412694";

/** Appointment boards with their jail-intake link column */
const APPOINTMENT_BOARDS = [
  { name: "Appointments R",  id: "7788520205", jailLinkCol: "link_to_jail_intakes_mkn2ckr3", profileLinkCol: "connect_boards4__1" },
  { name: "Appointments M",  id: "8025383981", jailLinkCol: "link_to_jail_intakes_mkn2zsy5", profileLinkCol: "connect_boards4__1" },
  { name: "Appointments LB", id: "8025389724", jailLinkCol: "link_to_jail_intakes_mkn2f86p", profileLinkCol: "connect_boards4__1" },
  { name: "Appointments WH", id: "9283837796", jailLinkCol: "connect_boards_mkn2e8ct",       profileLinkCol: "connect_boards4__1" },
];

/** Jail intake columns → canonical field names */
const JAIL_FIELD_MAP: Record<string, string> = {
  dup__of_first_name2__1: "a_number",
  date_of_birth_mkn33y83: "date_of_birth",
  country_of_birth__1: "country_of_birth",
  // phone is special: POC Name + POC Phone combined
  // text_mkkgcg74 = POC Name and relationship
  // text2 = POC Phone
  text: "email",           // POC Email
  text_mkkg24xy: "address", // Jail (used for physical + mailing address)
};

/** Columns to fetch from jail intakes */
const JAIL_SOURCE_COL_IDS = [
  "dup__of_first_name2__1",   // Alien Number
  "date_of_birth_mkn33y83",   // Date of Birth
  "country_of_birth__1",      // Country of Birth
  "text_mkkgcg74",            // POC Name and relationship
  "text2",                    // POC Phone
  "text",                     // POC Email
  "text_mkkg24xy",            // Jail
  "date3__1",                 // Consult Date
];

/** Canonical field → target profile column */
const TARGET_FIELD_MAP: Record<string, { columnId: string; title: string }> = {
  a_number:          { columnId: "text__1",              title: "A Number" },
  date_of_birth:     { columnId: "text2__1",             title: "Date of Birth" },
  country_of_birth:  { columnId: "country_of_birth__1",  title: "Country of Birth" },
  phone:             { columnId: "phone7__1",            title: "Phone" },
  email:             { columnId: "email__1",             title: "E-mail" },
  address_mailing:   { columnId: "physical_address8__1", title: "Mailing Address" },
  address_physical:  { columnId: "text_mkrkrsgj",        title: "Physical Address" },
};

const PROFILE_TARGET_COL_IDS = [
  "text__1",              // A Number
  "text2__1",             // Date of Birth
  "country_of_birth__1",  // Country of Birth
  "phone7__1",            // Phone
  "email__1",             // E-mail
  "physical_address8__1", // Mailing Address
  "text_mkrkrsgj",        // Physical Address
];

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
// Types
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

interface FieldDecision {
  field: string;
  targetColumnId: string;
  targetTitle: string;
  currentTargetValue: string;
  decision: string;
  reason: string;
  sourceValue: string | null;
  sourceAppointmentId: string | null; // jail intake ID
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
  const colIds = JSON.stringify(columnIds);

  const boardRelationFragment = useBoardRelation
    ? `... on BoardRelationValue { linked_item_ids }`
    : "";

  const firstQuery = `query {
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
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
      next_items_page(limit: 500, cursor: $cursor) {
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
// Helpers
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
    return cv.text?.trim() || null;
  }
}

/**
 * Build the phone value by combining POC name/relationship + phone number.
 * Example: "Wife: 816-994-2300"
 */
function buildPhoneValue(item: Item): string {
  const pocName = getColText(item, "text_mkkgcg74"); // POC Name and relationship
  const pocPhone = getColText(item, "text2");         // POC Phone

  if (!isSourceUsable(pocPhone)) return "";

  if (isSourceUsable(pocName)) {
    return `${pocName}: ${pocPhone}`;
  }
  return pocPhone;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();

  // Step 1: Build the jail intake → profile mapping via appointment boards
  console.log("Step 1: Building jail intake → appointment → profile chain...\n");

  // jailIntakeId → { profileId, apptId, apptBoard, consultDate }
  const jailToProfile = new Map<string, { profileId: string; apptId: string; apptBoard: string }>();

  for (const board of APPOINTMENT_BOARDS) {
    console.log(`  Scanning ${board.name}...`);
    const items = await fetchAllBoardItems(
      board.id,
      [board.jailLinkCol, board.profileLinkCol],
      true
    );
    console.log(`    → ${items.length} appointments`);

    let linked = 0;
    for (const appt of items) {
      const jailIds = getLinkedIds(appt, board.jailLinkCol);
      const profileIds = getLinkedIds(appt, board.profileLinkCol);

      if (jailIds.length > 0 && profileIds.length > 0) {
        linked++;
        for (const jailId of jailIds) {
          // Only store first mapping per jail intake (first appointment wins)
          if (!jailToProfile.has(jailId)) {
            jailToProfile.set(jailId, {
              profileId: profileIds[0],
              apptId: appt.id,
              apptBoard: board.name,
            });
          }
        }
      }
    }
    console.log(`    → ${linked} appointments linked to both jail intake + profile`);
  }

  console.log(`\n  Total jail intakes traceable to profiles: ${jailToProfile.size}\n`);

  // Step 2: Fetch jail intake data for traceable intakes
  console.log("Step 2: Fetching jail intake data...");
  const jailItems = await fetchAllBoardItems(JAIL_INTAKES_BOARD, JAIL_SOURCE_COL_IDS, false);
  console.log(`  → ${jailItems.length} jail intakes fetched`);

  // Index jail intakes by ID
  const jailById = new Map<string, Item>();
  for (const item of jailItems) {
    jailById.set(item.id, item);
  }

  // Step 3: Fetch profiles that have a traceable jail intake
  const traceableProfileIds = new Set<string>();
  for (const mapping of jailToProfile.values()) {
    traceableProfileIds.add(mapping.profileId);
  }

  console.log(`\nStep 3: Fetching ${traceableProfileIds.size} traceable profiles...\n`);
  const allProfiles = await fetchAllBoardItems(PROFILES_BOARD, PROFILE_TARGET_COL_IDS, false);
  console.log(`  → ${allProfiles.length} total profiles fetched`);

  // Index profiles
  const profileById = new Map<string, Item>();
  for (const p of allProfiles) {
    profileById.set(p.id, p);
  }

  // Step 4: Generate report
  console.log("\nStep 4: Generating field-by-field report...\n");

  mkdirSync("reports", { recursive: true });
  const reportPath = `reports/jail-source-scan-${new Date().toISOString().slice(0, 10)}.jsonl`;
  writeFileSync(reportPath, ""); // clear

  const ALL_FIELDS = [
    "a_number", "date_of_birth", "country_of_birth",
    "phone", "email", "address_mailing", "address_physical",
  ];

  // Counters
  const summary = {
    totalJailIntakes: jailItems.length,
    traceableToProfile: jailToProfile.size,
    profilesNotFound: 0,
    profilesFullyFilled: 0,
    profilesNeedingWork: 0,
    fieldCounts: {} as Record<string, Record<string, number>>,
  };

  for (const f of ALL_FIELDS) {
    summary.fieldCounts[f] = {
      WILL_UPDATE: 0,
      SKIPPED_TARGET_NOT_EMPTY: 0,
      SKIPPED_SOURCE_EMPTY: 0,
    };
  }

  // Process each traceable jail intake → profile pair
  for (const [jailId, mapping] of jailToProfile) {
    const jailItem = jailById.get(jailId);
    if (!jailItem) continue;

    const profile = profileById.get(mapping.profileId);
    if (!profile) {
      summary.profilesNotFound++;
      continue;
    }

    const consultDate = parseConsultDate(jailItem);

    // Build source values from jail intake
    const sourceValues: Record<string, string> = {};
    for (const [sourceColId, canonicalField] of Object.entries(JAIL_FIELD_MAP)) {
      const text = getColText(jailItem, sourceColId);
      if (isSourceUsable(text)) {
        sourceValues[canonicalField] = text;
      }
    }

    // Phone is special: combine POC name + phone
    const phoneValue = buildPhoneValue(jailItem);
    if (isSourceUsable(phoneValue)) {
      sourceValues["phone"] = phoneValue;
    }

    // Evaluate each target field
    const fields: FieldDecision[] = [];
    let hasAnyUpdate = false;

    for (const canonicalField of ALL_FIELDS) {
      const target = TARGET_FIELD_MAP[canonicalField];
      if (!target) continue;

      const currentValue = getColText(profile, target.columnId);

      if (!isFieldEmpty(currentValue)) {
        fields.push({
          field: canonicalField,
          targetColumnId: target.columnId,
          targetTitle: target.title,
          currentTargetValue: currentValue,
          decision: "SKIPPED_TARGET_NOT_EMPTY",
          reason: "Target field already has a value",
          sourceValue: null,
          sourceAppointmentId: null,
          sourceBoard: null,
          sourceConsultDate: null,
        });
        summary.fieldCounts[canonicalField]["SKIPPED_TARGET_NOT_EMPTY"]++;
        continue;
      }

      // For address fields, the source key is "address"
      const sourceKey = (canonicalField === "address_mailing" || canonicalField === "address_physical")
        ? "address"
        : canonicalField;

      const sourceVal = sourceValues[sourceKey];

      if (!isSourceUsable(sourceVal ?? "")) {
        fields.push({
          field: canonicalField,
          targetColumnId: target.columnId,
          targetTitle: target.title,
          currentTargetValue: "",
          decision: "SKIPPED_SOURCE_EMPTY",
          reason: "Jail intake has no usable value for this field",
          sourceValue: null,
          sourceAppointmentId: null,
          sourceBoard: null,
          sourceConsultDate: null,
        });
        summary.fieldCounts[canonicalField]["SKIPPED_SOURCE_EMPTY"]++;
        continue;
      }

      fields.push({
        field: canonicalField,
        targetColumnId: target.columnId,
        targetTitle: target.title,
        currentTargetValue: "",
        decision: "WILL_UPDATE",
        reason: `Source from Jail Intakes (consult: ${consultDate ?? "unknown"})`,
        sourceValue: sourceVal!,
        sourceAppointmentId: jailId,
        sourceBoard: "Jail Intakes",
        sourceConsultDate: consultDate,
      });
      summary.fieldCounts[canonicalField]["WILL_UPDATE"]++;
      hasAnyUpdate = true;
    }

    if (hasAnyUpdate) summary.profilesNeedingWork++;
    else summary.profilesFullyFilled++;

    const report: ProfileReport = {
      profileId: profile.id,
      profileName: profile.name,
      linkedAppointmentCount: 1, // one jail intake
      fields,
    };

    appendFileSync(reportPath, JSON.stringify(report) + "\n");
  }

  // Step 5: Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`${"=".repeat(70)}`);
  console.log(`JAIL INTAKES → PROFILES SOURCE SCAN REPORT`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\nTotal jail intakes: ${summary.totalJailIntakes}`);
  console.log(`Traceable to profiles (via appointments): ${summary.traceableToProfile}`);
  console.log(`Profiles not found in board: ${summary.profilesNotFound}`);
  console.log(`Profiles needing at least one update: ${summary.profilesNeedingWork}`);
  console.log(`Profiles already fully filled: ${summary.profilesFullyFilled}`);

  console.log(`\nPer-field breakdown:\n`);
  console.log(
    `${"Field".padEnd(22)} ${"WILL_UPDATE".padStart(12)} ${"TGT_FILLED".padStart(12)} ${"SRC_EMPTY".padStart(12)}`
  );
  console.log(`${"-".repeat(22)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(12)}`);

  for (const f of ALL_FIELDS) {
    const c = summary.fieldCounts[f];
    const title = TARGET_FIELD_MAP[f]?.title ?? f;
    console.log(
      `${title.padEnd(22)} ${String(c.WILL_UPDATE ?? 0).padStart(12)} ${String(c.SKIPPED_TARGET_NOT_EMPTY ?? 0).padStart(12)} ${String(c.SKIPPED_SOURCE_EMPTY ?? 0).padStart(12)}`
    );
  }

  console.log(`\nFull report written to: ${reportPath}`);
  console.log(`Completed in ${elapsed}s`);
}

main().catch(console.error);
