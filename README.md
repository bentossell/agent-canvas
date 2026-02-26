# agent-canvas

Web-based agent canvas. Agent POSTs HTML, canvas renders live in the browser. No desktop app, no MCP config.

## Install

```bash
bun install
```

## Usage

```bash
# Start the canvas server
bun run src/cli.ts
# or with custom port
bun run src/cli.ts --port 4000
```

Opens `http://localhost:3333` in your browser.

## API

### POST /render
Render HTML to a canvas panel. Updates the browser instantly via WebSocket.

```bash
curl -X POST http://localhost:3333/render \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello from agent</h1>", "panel": "default"}'
```

### POST /push
Save panel HTML to a local file.

```bash
curl -X POST http://localhost:3333/push \
  -H "Content-Type: application/json" \
  -d '{"panel": "default", "path": "./output/hero.html"}'
```

### POST /pull
Load an HTML file into a panel.

```bash
curl -X POST http://localhost:3333/pull \
  -H "Content-Type: application/json" \
  -d '{"path": "./components/header.html", "panel": "header"}'
```

### GET /state
Get current HTML of all panels.

```bash
curl http://localhost:3333/state
```

### GET / or /canvas
The canvas page itself.

## Multi-panel

Send to different panels by name:

```bash
curl -X POST http://localhost:3333/render \
  -d '{"html": "<nav>Nav</nav>", "panel": "nav"}'
curl -X POST http://localhost:3333/render \
  -d '{"html": "<main>Content</main>", "panel": "main"}'
```

Panels appear side by side. Add/remove panels from the UI toolbar.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3333 | HTTP port (WebSocket runs on port+1) |
| `--no-open` | false | Don't auto-open browser |

## Test

```bash
bun test
```
