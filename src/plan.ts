/**
 * Dry-run: shows what each edit batch would change without touching Monday.com.
 *
 * Usage: bun run plan [config/edits.yaml]
 */

import { loadEdits } from "./load-edits";
import { queryItems, type MondayItem } from "./monday-client";

const configPath = process.argv[2] || "config/edits.yaml";
const edits = await loadEdits(configPath);

if (edits.length === 0) {
  console.log("No edits defined in", configPath);
  process.exit(0);
}

for (const batch of edits) {
  console.log(`\n== ${batch.name} ==`);
  console.log(`   Board: ${batch.board_id}`);

  const items = await queryItems(batch.board_id);
  const matched = filterItems(items, batch.filter);

  console.log(`   Items on board: ${items.length}`);
  console.log(`   Items matching filter: ${matched.length}`);

  if (matched.length === 0) {
    console.log("   (nothing to change)");
    continue;
  }

  // Show a preview of the first 5 items
  const preview = matched.slice(0, 5);
  for (const item of preview) {
    console.log(`\n   Item #${item.id} — ${item.name}`);
    for (const change of batch.changes) {
      const current = item.column_values.find((c) => c.id === change.column_id);
      console.log(`     ${change.column_id}: "${current?.text ?? "(empty)"}" → ${JSON.stringify(change.value)}`);
    }
  }

  if (matched.length > 5) {
    console.log(`\n   ... and ${matched.length - 5} more items`);
  }
}

function filterItems(
  items: MondayItem[],
  filter?: { column_id: string; value: string }
): MondayItem[] {
  if (!filter) return items;
  return items.filter((item) => {
    const col = item.column_values.find((c) => c.id === filter.column_id);
    return col?.text === filter.value;
  });
}
