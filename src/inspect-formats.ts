/**
 * Inspect existing filled values in Profiles to understand format conventions.
 * Samples A Number and Date of Birth formats from already-filled entries.
 */

const API_URL = "https://api.monday.com/v2";
const PROFILES_BOARD = "8025265377";

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

async function fetchAllItems(): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  const colIds = JSON.stringify(["text__1", "text2__1"]);

  const firstQuery = `query {
    boards(ids: [${PROFILES_BOARD}]) {
      items_page(limit: 500) {
        cursor
        items {
          id
          column_values(ids: ${colIds}) { id text }
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
          column_values(ids: ${colIds}) { id text }
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

function classify(value: string): string {
  if (/^\d{9}$/.test(value)) return "9digits_no_sep (e.g. 036192668)";
  if (/^\d{3}-\d{3}-\d{3}$/.test(value)) return "3-3-3 dashes (e.g. 243-069-226)";
  if (/^\d{3} \d{3} \d{3}$/.test(value)) return "3-3-3 spaces";
  if (/^A?\d{9}$/.test(value)) return "A + 9digits";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "MM/DD/YYYY";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return "M/D/YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "YYYY-MM-DD";
  if (/^\d{8}$/.test(value)) return "8digits_no_sep (e.g. 07061984)";
  if (/^[A-Z][a-z]{2} \d{1,2} \d{4}$/.test(value)) return "Mon DD YYYY";
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) return "M/D/YY";
  return `other: "${value.slice(0, 40)}"`;
}

async function main() {
  const items = await fetchAllItems();

  const aNumberFormats: Record<string, number> = {};
  const dobFormats: Record<string, number> = {};
  const aNumberSamples: Record<string, string[]> = {};
  const dobSamples: Record<string, string[]> = {};

  for (const item of items) {
    for (const cv of item.column_values) {
      const text = cv.text?.trim();
      if (!text || text === "null") continue;

      const fmt = classify(text);
      if (cv.id === "text__1") {
        aNumberFormats[fmt] = (aNumberFormats[fmt] ?? 0) + 1;
        if (!aNumberSamples[fmt]) aNumberSamples[fmt] = [];
        if (aNumberSamples[fmt].length < 3) aNumberSamples[fmt].push(text);
      } else if (cv.id === "text2__1") {
        dobFormats[fmt] = (dobFormats[fmt] ?? 0) + 1;
        if (!dobSamples[fmt]) dobSamples[fmt] = [];
        if (dobSamples[fmt].length < 3) dobSamples[fmt].push(text);
      }
    }
  }

  console.log("=== A Number formats (text__1) ===\n");
  const aSorted = Object.entries(aNumberFormats).sort((a, b) => b[1] - a[1]);
  for (const [fmt, count] of aSorted) {
    console.log(`  ${String(count).padStart(6)} × ${fmt}`);
    console.log(`         samples: ${aNumberSamples[fmt].join(", ")}`);
  }

  console.log("\n=== Date of Birth formats (text2__1) ===\n");
  const dSorted = Object.entries(dobFormats).sort((a, b) => b[1] - a[1]);
  for (const [fmt, count] of dSorted) {
    console.log(`  ${String(count).padStart(6)} × ${fmt}`);
    console.log(`         samples: ${dobSamples[fmt].join(", ")}`);
  }
}

main().catch(console.error);
