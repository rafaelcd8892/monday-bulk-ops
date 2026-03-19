import { mkdirSync } from "node:fs";

const LOG_DIR = "logs";

export interface MutationLog {
  timestamp: string;
  batch: string;
  board_id: string;
  item_id: string;
  item_name: string;
  changes: Record<string, { old: string; new: unknown }>;
  status: "applied" | "failed";
  error?: string;
}

let logFile: ReturnType<typeof Bun.file> | null = null;
let logPath: string = "";

export function initLog(batchName: string): string {
  mkdirSync(LOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = batchName.replace(/[^a-zA-Z0-9_-]/g, "_");
  logPath = `${LOG_DIR}/${ts}_${safeName}.jsonl`;
  logFile = null; // reset
  return logPath;
}

export async function appendLog(entry: MutationLog): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  await Bun.write(logPath, (await Bun.file(logPath).exists() ? await Bun.file(logPath).text() : "") + line);
}
