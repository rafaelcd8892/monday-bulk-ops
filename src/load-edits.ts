import YAML from "yaml";

export interface EditChange {
  column_id: string;
  value: unknown;
}

export interface EditBatch {
  name: string;
  board_id: string;
  filter?: {
    column_id: string;
    value: string;
  };
  changes: EditChange[];
}

export async function loadEdits(path = "config/edits.yaml"): Promise<EditBatch[]> {
  const file = Bun.file(path);
  const text = await file.text();
  const parsed = YAML.parse(text);

  if (!parsed?.edits || !Array.isArray(parsed.edits)) {
    return [];
  }

  for (const edit of parsed.edits) {
    if (!edit.name) throw new Error("Each edit batch must have a 'name'");
    if (!edit.board_id) throw new Error(`Edit "${edit.name}" missing 'board_id'`);
    if (!edit.changes?.length) throw new Error(`Edit "${edit.name}" has no 'changes'`);
  }

  return parsed.edits;
}
