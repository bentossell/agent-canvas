# agent-canvas

Web agent canvas — POST HTML, renders live in browser via WebSocket.

## Commands
- `bun install` — install deps
- `bun test` — run tests
- `bunx tsc --noEmit` — typecheck
- `bun run src/cli.ts --no-open` — start server (no browser)

## Structure
- `src/cli.ts` — CLI entry, starts HTTP + WS servers, bootstraps persisted state
- `src/server.ts` — Hono app + endpoints + ws broadcast
- `src/canvas-html.ts` — single HTML string UI
- `src/screenshot.ts` — screenshot capture via agent-browser CLI
- `src/state-store.ts` — load/persist `.agent-canvas/state.json`
- `src/server.test.ts` — endpoint tests
- `spec/` — specs + progress (`v2-usability.md`, `progress.md`)

## API
- `POST /render` — `{html, panel?}` → renders in browser
- `POST /push` — `{panel?, path}` → saves panel to file (cwd-only path guard)
- `POST /pull` — `{panel?, path}` → loads file into panel (cwd-only path guard)
- `GET /panels` — list panel names
- `POST /panels` — create panel (`{name?}`)
- `PATCH /panels/:name` — rename panel (`{newName}`)
- `DELETE /panels/:name` — delete panel (cannot delete last panel)
- `GET /state` — all panel HTML
- `GET /screenshot` — PNG screenshot (`width`, `height` query)
- `GET /` — canvas page
