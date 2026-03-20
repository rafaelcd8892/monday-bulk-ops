/**
 * Discover board structures — columns, IDs, and types.
 * Usage: bun src/discover-boards.ts
 */

const API_URL = "https://api.monday.com/v2";

function getToken(): string {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN is not set.");
  return token;
}

async function gql(query: string): Promise<any> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken(),
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Monday API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json;
}

const BOARDS = [
  { name: "Profiles", id: "8025265377" },
  { name: "Appointments R", id: "7788520205" },
  { name: "Appointments M", id: "8025383981" },
  { name: "Appointments LB", id: "8025389724" },
  { name: "Appointments WH", id: "9283837796" },
];

async function discoverBoard(board: { name: string; id: string }) {
  const query = `query {
    boards(ids: [${board.id}]) {
      name
      columns {
        id
        title
        type
        settings_str
      }
    }
  }`;

  const res = await gql(query);
  const data = res.data.boards[0];
  if (!data) {
    console.error(`Board ${board.name} (${board.id}) not found.`);
    return;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`${board.name} — Board ID: ${board.id}`);
  console.log(`API Name: ${data.name}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`${"Column ID".padEnd(30)} ${"Title".padEnd(30)} Type`);
  console.log(`${"-".repeat(30)} ${"-".repeat(30)} ${"-".repeat(20)}`);

  for (const col of data.columns) {
    console.log(`${col.id.padEnd(30)} ${col.title.padEnd(30)} ${col.type}`);
  }
}

async function main() {
  for (const board of BOARDS) {
    await discoverBoard(board);
  }
}

main().catch(console.error);
