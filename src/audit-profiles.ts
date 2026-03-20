/**
 * Audit Profiles board — count empty vs filled for target columns.
 * Also checks which profiles have linked appointments via board_relation.
 * Usage: bun src/audit-profiles.ts
 */

const API_URL = "https://api.monday.com/v2";
const PROFILES_BOARD = "8025265377";

const TARGET_COLUMNS = [
  { id: "text__1", title: "A Number" },
  { id: "text2__1", title: "Date of Birth" },
  { id: "country_of_birth__1", title: "Country of Birth" },
  { id: "phone7__1", title: "Phone" },
  { id: "email__1", title: "E-mail" },
  { id: "physical_address8__1", title: "Mailing Address" },
  { id: "text_mkrkrsgj", title: "Physical Address" },
];

const APPOINTMENTS_COL = "link_to_r__1";
const ALL_COL_IDS = [...TARGET_COLUMNS.map(c => c.id), APPOINTMENTS_COL];

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

interface ColumnValue {
  id: string;
  text: string;
  value: string | null;
  linked_item_ids?: string[];
}

interface ItemRow {
  id: string;
  name: string;
  column_values: ColumnValue[];
}

async function fetchAllItems(): Promise<ItemRow[]> {
  const all: ItemRow[] = [];
  let cursor: string | null = null;
  const limit = 500;

  const colIds = JSON.stringify(ALL_COL_IDS);

  const firstQuery = `query {
    boards(ids: [${PROFILES_BOARD}]) {
      items_page(limit: ${limit}) {
        cursor
        items {
          id
          name
          column_values(ids: ${colIds}) {
            id
            text
            value
            ... on BoardRelationValue {
              linked_item_ids
            }
          }
        }
      }
    }
  }`;

  const firstRes = await gql(firstQuery);
  const firstPage = firstRes.data.boards[0].items_page;
  all.push(...firstPage.items);
  cursor = firstPage.cursor;
  process.stdout.write(`Fetched ${all.length} items...`);

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
            ... on BoardRelationValue {
              linked_item_ids
            }
          }
        }
      }
    }`;

    const nextRes = await gql(nextQuery, { cursor });
    const page = nextRes.data.next_items_page;
    all.push(...page.items);
    cursor = page.cursor;
    process.stdout.write(`\rFetched ${all.length} items...`);
  }

  console.log(` Done.`);
  return all;
}

function isFieldEmpty(col: ColumnValue): boolean {
  if (!col.text || col.text.trim() === "") return true;
  return false;
}

function hasLinkedAppointments(item: ItemRow): boolean {
  const col = item.column_values.find(c => c.id === APPOINTMENTS_COL);
  if (!col) return false;
  return Array.isArray(col.linked_item_ids) && col.linked_item_ids.length > 0;
}

function computeStats(subset: ItemRow[]) {
  const stats: Record<string, { empty: number; filled: number }> = {};
  for (const col of TARGET_COLUMNS) {
    stats[col.id] = { empty: 0, filled: 0 };
  }
  let fullyFilled = 0;
  let someEmpty = 0;
  let allEmpty = 0;

  for (const item of subset) {
    let emptyCount = 0;
    for (const col of TARGET_COLUMNS) {
      const cv = item.column_values.find(c => c.id === col.id);
      if (!cv || isFieldEmpty(cv)) {
        stats[col.id].empty++;
        emptyCount++;
      } else {
        stats[col.id].filled++;
      }
    }
    if (emptyCount === TARGET_COLUMNS.length) allEmpty++;
    else if (emptyCount > 0) someEmpty++;
    else fullyFilled++;
  }
  return { stats, fullyFilled, someEmpty, allEmpty };
}

function printStats(label: string, subset: ItemRow[], result: ReturnType<typeof computeStats>) {
  const { stats, fullyFilled, someEmpty, allEmpty } = result;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${label} — ${subset.length} items`);
  console.log(`${"=".repeat(70)}\n`);

  console.log(`${"Column".padEnd(25)} ${"Empty".padStart(8)} ${"Filled".padStart(8)} ${"% Empty".padStart(10)}`);
  console.log(`${"-".repeat(25)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(10)}`);

  for (const col of TARGET_COLUMNS) {
    const s = stats[col.id];
    const pct = subset.length > 0 ? ((s.empty / subset.length) * 100).toFixed(1) : "0.0";
    console.log(`${col.title.padEnd(25)} ${String(s.empty).padStart(8)} ${String(s.filled).padStart(8)} ${(pct + "%").padStart(10)}`);
  }

  console.log(`\n  Fully filled (no action needed):     ${fullyFilled}`);
  console.log(`  Some fields empty (partial backfill): ${someEmpty}`);
  console.log(`  All fields empty (full backfill):     ${allEmpty}`);
  console.log(`  Total needing work:                   ${someEmpty + allEmpty}`);
}

async function main() {
  console.log("Auditing Profiles board for empty fields...\n");
  const items = await fetchAllItems();

  const withAppts = items.filter(hasLinkedAppointments);
  const withoutAppts = items.filter(i => !hasLinkedAppointments(i));

  console.log(`\n${"=".repeat(70)}`);
  console.log(`APPOINTMENT LINKAGE — ${items.length} total profiles`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  With appointments linked:    ${withAppts.length}`);
  console.log(`  Without appointments linked: ${withoutAppts.length} (cannot backfill)`);

  printStats("ACTIONABLE PROFILES (with appointments)", withAppts, computeStats(withAppts));
  printStats("NON-ACTIONABLE PROFILES (no appointments)", withoutAppts, computeStats(withoutAppts));
}

main().catch(console.error);
