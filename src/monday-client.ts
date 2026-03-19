/**
 * Monday.com GraphQL client with rate-limit handling.
 *
 * Rate limits: Monday allows ~5M complexity points per minute.
 * We add a small delay between mutations to stay well within limits.
 */

const API_URL = "https://api.monday.com/v2";
const MUTATION_DELAY_MS = 350; // ~170 mutations/min, safe margin

function getToken(): string {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN is not set. Copy .env.example to .env and add your token.");
  return token;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: { id: string; text: string; value: string | null }[];
}

export async function queryItems(boardId: string, limit = 500): Promise<MondayItem[]> {
  const query = `query {
    boards(ids: [${boardId}]) {
      items_page(limit: ${limit}) {
        items {
          id
          name
          column_values {
            id
            text
            value
          }
        }
      }
    }
  }`;

  const res = await gql(query);
  return res.data.boards[0]?.items_page?.items ?? [];
}

export async function changeColumnValues(
  boardId: string,
  itemId: string,
  columnValues: Record<string, unknown>
): Promise<unknown> {
  const query = `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }`;

  const variables = {
    boardId,
    itemId,
    columnValues: JSON.stringify(columnValues),
  };

  return gql(query, variables);
}

export async function batchMutate(
  boardId: string,
  mutations: { itemId: string; columnValues: Record<string, unknown> }[],
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: { itemId: string; error: string }[] }> {
  let success = 0;
  const failed: { itemId: string; error: string }[] = [];

  for (let i = 0; i < mutations.length; i++) {
    const { itemId, columnValues } = mutations[i];
    try {
      await changeColumnValues(boardId, itemId, columnValues);
      success++;
    } catch (err) {
      failed.push({ itemId, error: String(err) });
    }
    onProgress?.(i + 1, mutations.length);

    if (i < mutations.length - 1) {
      await Bun.sleep(MUTATION_DELAY_MS);
    }
  }

  return { success, failed };
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monday API ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
  }
  return json;
}
