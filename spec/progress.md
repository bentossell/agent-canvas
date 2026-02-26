# agent-canvas progress

## Done
- [x] Local HTTP server (Hono + Bun)
- [x] POST /render endpoint — accepts HTML, stores in panel, broadcasts via WS
- [x] GET /canvas — single HTML page with inline WS client
- [x] WebSocket live reload — agent writes, canvas updates instantly
- [x] Push to file — POST /push saves panel HTML to local file
- [x] Pull from file — POST /pull loads HTML file into panel
- [x] Multi-panel — multiple canvases side by side, add/remove from UI
- [x] GET /state — returns all panel contents
- [x] CLI with --port and --no-open flags
- [x] Auto-open browser on start
- [x] Tests (11 passing)
- [x] TypeScript strict, clean typecheck

## TODO
- [ ] Screenshot endpoint (GET /screenshot → PNG)
- [ ] Panel resize (drag handles)
- [ ] History/undo per panel
