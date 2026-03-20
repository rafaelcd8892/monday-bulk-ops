/**
 * Debug: figure out how to read board_relation linked items from the API.
 */

const API_URL = "https://api.monday.com/v2";

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

// Try approach: query linked_items on the board_relation column
async function main() {
  console.log("=== Approach: linked_items on column_values ===\n");

  const query = `query {
    boards(ids: [8025265377]) {
      items_page(limit: 10) {
        items {
          id
          name
          column_values(ids: ["link_to_r__1"]) {
            id
            type
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

  const res = await gql(query);
  const items = res.data.boards[0].items_page.items;
  for (const item of items) {
    const cv = item.column_values[0];
    console.log(`${item.name} (${item.id})`);
    console.log(`  text="${cv.text}" value=${cv.value} linked_item_ids=${JSON.stringify(cv.linked_item_ids)}`);
  }

  // Also try from appointment side
  console.log("\n=== Appointments R → Profiles link ===\n");

  const query2 = `query {
    boards(ids: [7788520205]) {
      items_page(limit: 10) {
        items {
          id
          name
          column_values(ids: ["connect_boards4__1", "board_relation_mknzm1as"]) {
            id
            type
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

  const res2 = await gql(query2);
  const items2 = res2.data.boards[0].items_page.items;
  for (const item of items2) {
    console.log(`${item.name} (${item.id})`);
    for (const cv of item.column_values) {
      console.log(`  [${cv.id}] text="${cv.text}" value=${cv.value} linked_item_ids=${JSON.stringify(cv.linked_item_ids)}`);
    }
  }
}

main().catch(console.error);
