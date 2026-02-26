// server.ts — Hono HTTP server + Bun WebSocket for live canvas updates

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { canvasPage } from './canvas-html'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'

export interface CanvasState {
	panels: Map<string, string>
}

export function createApp(state: CanvasState) {
	const app = new Hono()
	app.use('*', cors())

	// Serve canvas page
	app.get('/', (c) => {
		return c.html(canvasPage(state.wsPort ?? 3334))
	})

	app.get('/canvas', (c) => {
		return c.html(canvasPage(state.wsPort ?? 3334))
	})

	// Agent renders HTML to a panel
	app.post('/render', async (c) => {
		const body = await c.req.json<{ html: string; panel?: string }>()
		if (!body.html) {
			return c.json({ ok: false, error: 'missing html field' }, 400)
		}
		const panel = body.panel || 'default'
		state.panels.set(panel, body.html)
		broadcastToClients(state, { type: 'render', panel, html: body.html })
		return c.json({ ok: true, panel })
	})

	// Push panel HTML to a file
	app.post('/push', async (c) => {
		const body = await c.req.json<{ panel?: string; path: string }>()
		if (!body.path) {
			return c.json({ ok: false, error: 'missing path field' }, 400)
		}
		const panel = body.panel || 'default'
		const html = state.panels.get(panel)
		if (!html) {
			return c.json({ ok: false, error: `panel "${panel}" has no content` }, 404)
		}
		try {
			const filePath = resolve(state.cwd, body.path)
			await writeFile(filePath, html, 'utf-8')
			return c.json({ ok: true, path: filePath })
		} catch (err) {
			return c.json({ ok: false, error: String(err) }, 500)
		}
	})

	// Pull file HTML into a panel
	app.post('/pull', async (c) => {
		const body = await c.req.json<{ panel?: string; path: string }>()
		if (!body.path) {
			return c.json({ ok: false, error: 'missing path field' }, 400)
		}
		const panel = body.panel || 'default'
		try {
			const filePath = resolve(state.cwd, body.path)
			const html = await readFile(filePath, 'utf-8')
			state.panels.set(panel, html)
			broadcastToClients(state, { type: 'render', panel, html })
			return c.json({ ok: true, panel, html })
		} catch (err) {
			return c.json({ ok: false, error: String(err) }, 500)
		}
	})

	// Get current state of all panels
	app.get('/state', (c) => {
		const result: Record<string, string> = {}
		for (const [k, v] of state.panels) {
			result[k] = v
		}
		return c.json({ panels: result })
	})

	return app
}

// WebSocket broadcast
const wsClients = new Set<{ send: (data: string) => void }>()

export function addWsClient(ws: { send: (data: string) => void }) {
	wsClients.add(ws)
}

export function removeWsClient(ws: { send: (data: string) => void }) {
	wsClients.delete(ws)
}

function broadcastToClients(_state: CanvasState, msg: unknown) {
	const data = JSON.stringify(msg)
	for (const client of wsClients) {
		try {
			client.send(data)
		} catch {
			wsClients.delete(client)
		}
	}
}

// Extend state type with runtime fields
declare module './server' {
	interface CanvasState {
		wsPort?: number
		cwd: string
	}
}
