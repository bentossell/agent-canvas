# agent-canvas

Web canvas for agent-generated UI. POST HTML, see it render live. No desktop app. No MCP setup.

## Install

```bash
bun install
```

## Run

```bash
bun run src/cli.ts
# custom port
bun run src/cli.ts --port 4000
```

Opens `http://localhost:3333`.

## What’s improved (v2/v3)

- In-app onboarding (`? What is this`, `▶ Try demo`)
- Server-backed panel lifecycle (create/rename/delete)
- Inline push/pull form in toolbar (no prompts)
- Path-safe file sync (cwd-only)
- Persistent state in `.agent-canvas/state.json`
- Screenshot endpoint (`GET /screenshot`) + UI button

## Core API

### Render

```bash
curl -X POST http://localhost:3333/render \
  -H "Content-Type: application/json" \
  -d '{"panel":"default","html":"<h1>Hello</h1>"}'
```

### Panels

```bash
curl http://localhost:3333/panels
curl -X POST http://localhost:3333/panels -H "Content-Type: application/json" -d '{"name":"nav"}'
curl -X PATCH http://localhost:3333/panels/nav -H "Content-Type: application/json" -d '{"newName":"header"}'
curl -X DELETE http://localhost:3333/panels/header
```

### Push / Pull

```bash
curl -X POST http://localhost:3333/push \
  -H "Content-Type: application/json" \
  -d '{"panel":"default","path":"./output/hero.html"}'

curl -X POST http://localhost:3333/pull \
  -H "Content-Type: application/json" \
  -d '{"panel":"default","path":"./output/hero.html"}'
```

> Paths are restricted to current working directory.

### State

```bash
curl http://localhost:3333/state
```

### Screenshot

```bash
curl http://localhost:3333/screenshot?width=1280\&height=720 --output canvas.png
```

## Notes

- State persists at `.agent-canvas/state.json` in project cwd.
- WebSocket uses `/ws` on HTTPS hosts (works with tailscale serve).
- Multi-panel: render to different panel names (`nav`, `hero`, `footer`, etc).

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3333 | HTTP port (WS runs on port+1) |
| `--no-open` | false | Don’t auto-open browser |

## Test

```bash
bun test
bunx tsc --noEmit
```
