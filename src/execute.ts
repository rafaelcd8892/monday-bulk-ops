/**
 * Apply edits to Monday.com. Requires explicit --confirm flag.
 *
 * Usage:
 *   bun run execute                        # dry-run (same as plan)
 *   bun run execute --confirm              # apply changes
 *   bun run execute --confirm config/x.yaml
 */

import { loadEdits } from "./load-edits";
import { queryItems, changeColumnValues, type MondayItem } from "./monday-client";
import { initLog, appendLog, type MutationLog } from "./logger";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const configPath = args.find((a) => !a.startsWith("--")) || "config/edits.yaml";

const edits = await loadEdits(configPath);

if (edits.length === 0) {
  console.log("No edits defined in", configPath);
  process.exit(0);
}

if (!confirm) {
  console.log("Dry-run mode. Add --confirm to apply changes.\n");
}

for (const batch of edits) {
  console.log(`\n== ${batch.name} ==`);

  const items = await queryItems(batch.board_id);
  const matched = filterItems(items, batch.filter);

  console.log(`  Matched ${matched.length} / ${items.length} items`);

  if (matched.length === 0) continue;

  if (!confirm) {
    console.log("  (skipped — dry-run)");
    continue;
  }

  const logPath = initLog(batch.name);
  console.log(`  Logging to ${logPath}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < matched.length; i++) {
    const item = matched[i];
    const columnValues: Record<string, unknown> = {};
    const changeDiff: Record<string, { old: string; new: unknown }> = {};

    for (const change of batch.changes) {
      const current = item.column_values.find((c) => c.id === change.column_id);
      columnValues[change.column_id] = change.value;
      changeDiff[change.column_id] = {
        old: current?.text ?? "",
        new: change.value,
      };
    }

    const logEntry: MutationLog = {
      timestamp: new Date().toISOString(),
      batch: batch.name,
      board_id: batch.board_id,
      item_id: item.id,
      item_name: item.name,
      changes: changeDiff,
      status: "applied",
    };

    try {
      await changeColumnValues(batch.board_id, item.id, columnValues);
      success++;
    } catch (err) {
      logEntry.status = "failed";
      logEntry.error = String(err);
      failed++;
    }

    await appendLog(logEntry);

    // Progress
    if ((i + 1) % 10 === 0 || i === matched.length - 1) {
      console.log(`  Progress: ${i + 1}/${matched.length} (${success} ok, ${failed} failed)`);
    }

    // Rate limit pause
    if (i < matched.length - 1) {
      await Bun.sleep(350);
    }
  }

  console.log(`  Done: ${success} applied, ${failed} failed`);
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
