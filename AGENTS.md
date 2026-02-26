# agent-canvas

Web agent canvas — POST HTML, renders live in browser via WebSocket.

## Commands
- `bun install` — install deps
- `bun test` — run tests
- `bunx tsc --noEmit` — typecheck
- `bun run src/cli.ts --no-open` — start server (no browser)

## Structure
- `src/cli.ts` — CLI entry, starts HTTP + WS servers
- `src/server.ts` — Hono app, endpoints, WS broadcast
- `src/canvas-html.ts` — single HTML string for the canvas page
- `src/server.test.ts` — endpoint tests

## API
- `POST /render` — `{html, panel?}` → renders in browser
- `POST /push` — `{panel?, path}` → saves panel to file
- `POST /pull` — `{panel?, path}` → loads file into panel
- `GET /state` — all panels
- `GET /` — canvas page
