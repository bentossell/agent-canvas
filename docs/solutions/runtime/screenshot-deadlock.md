# Screenshot endpoint deadlock when self-capturing canvas

## symptom
`GET /screenshot` returned 503 with agent-browser timeout:

- `page.goto: Timeout ... navigating to "http://localhost:<port>/canvas"`

## cause
Screenshot handler used `Bun.spawnSync()` to run `agent-browser`.

Because the screenshot request was handled on the same process, sync subprocess calls blocked the server event loop. While blocked, `/canvas` could not be served to `agent-browser`, causing timeout.

## fix
Use async subprocess execution (`Bun.spawn` + `await process.exited`) for all agent-browser commands in `src/screenshot.ts`.

This keeps the server responsive while screenshot capture is in flight, so `/canvas` loads normally.

## verification
- `GET /screenshot?width=800&height=500` now returns `200 image/png`
- unit tests still pass (`bun test`)
- typecheck still passes (`bunx tsc --noEmit`)
