# agent-canvas progress

## Done
- [x] Local HTTP server (Hono + Bun)
- [x] POST /render endpoint — accepts HTML, stores in panel, broadcasts via WS
- [x] GET /canvas — single HTML page with inline WS client
- [x] WebSocket live reload — agent writes, canvas updates instantly
- [x] Push to file — POST /push saves panel HTML to local file
- [x] Pull from file — POST /pull loads HTML file into panel
- [x] Multi-panel — multiple canvases side by side
- [x] GET /state — returns all panel contents
- [x] CLI with --port and --no-open flags
- [x] Auto-open browser on start
- [x] TypeScript strict, clean typecheck

## v2 usability pass (2026-02-26)
- [x] Added panel lifecycle API: GET/POST/PATCH/DELETE /panels
- [x] UI now uses server-backed panel add/rename/delete
- [x] Added "What is this" help drawer with curl examples
- [x] Added "Try demo" button for quick onboarding
- [x] Added safe path guard: push/pull restricted to cwd

## v3 reliability + UX pass (2026-02-26)
- [x] Added screenshot endpoint: GET /screenshot (PNG)
- [x] Added inline push/pull inputs in toolbar (no prompt dialogs)
- [x] Added persistent state file: `.agent-canvas/state.json`
- [x] Fixed screenshot deadlock by switching to async agent-browser process calls
- [x] Expanded tests to 20 cases (screenshot + persistence + traversal)

## TODO
- [ ] Panel resize (drag handles)
- [ ] History/undo per panel
