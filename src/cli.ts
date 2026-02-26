#!/usr/bin/env bun
// cli.ts — start the agent-canvas server

import { createApp, addWsClient, removeWsClient, type CanvasState } from './server'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const httpPort = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3333
const wsPort = httpPort + 1
const noOpen = args.includes('--no-open')

const state: CanvasState = {
	panels: new Map(),
	wsPort,
	cwd: process.cwd(),
}

const app = createApp(state)

const wsHandler = {
	open(ws: any) {
		addWsClient(ws)
		for (const [panel, html] of state.panels) {
			ws.send(JSON.stringify({ type: 'render', panel, html }))
		}
	},
	close(ws: any) {
		removeWsClient(ws)
	},
	message() {},
}

// HTTP server with WebSocket upgrade on /ws
const httpServer = Bun.serve({
	port: httpPort,
	fetch(req, server) {
		const url = new URL(req.url)
		if (url.pathname === '/ws') {
			if (server.upgrade(req)) return
			return new Response('WebSocket upgrade failed', { status: 400 })
		}
		return app.fetch(req, server)
	},
	websocket: wsHandler,
})

// Standalone WS server for local dev (direct port access)
const wsServer = Bun.serve({
	port: wsPort,
	fetch(req, server) {
		if (server.upgrade(req)) return
		return new Response('WebSocket server', { status: 200 })
	},
	websocket: wsHandler,
})

console.log(`
  ◧ agent-canvas

  Canvas:  http://localhost:${httpPort}
  WS:      ws://localhost:${wsPort}

  Usage:
    curl -X POST http://localhost:${httpPort}/render \\
      -H "Content-Type: application/json" \\
      -d '{"html": "<h1>Hello from agent</h1>"}'
`)

// Open browser unless --no-open
if (!noOpen) {
	const { exec } = await import('child_process')
	const url = `http://localhost:${httpPort}`
	const cmd = process.platform === 'darwin' ? 'open' :
		process.platform === 'win32' ? 'start' : 'xdg-open'
	exec(`${cmd} ${url}`)
}
