Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Purpose

Mass-edit tool for Monday.com boards. Separate from case-pipeline (read-only dashboard) to keep concerns isolated.

## Safety

- `bun run plan` = dry-run, never mutates
- `bun run execute` = dry-run by default, requires `--confirm` to apply
- All mutations are logged to `logs/*.jsonl` with old/new values
