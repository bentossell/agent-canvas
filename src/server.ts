// server.ts — Hono HTTP server + Bun WebSocket for live canvas updates

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { canvasPage } from './canvas-html'
import { readFile, writeFile } from 'fs/promises'
import { resolve, sep } from 'path'
import { persistPanelsToDisk } from './state-store'
import { captureScreenshotViaAgentBrowser, type ScreenshotCapture } from './screenshot'

export interface CanvasState {
	panels: Map<string, string>
	wsPort?: number
	cwd: string
	stateFilePath: string
	captureScreenshot?: ScreenshotCapture
}

export function createApp(state: CanvasState) {
	const app = new Hono()
	app.use('*', cors())
	ensureDefaultPanel(state)

	app.get('/', (c) => c.html(canvasPage(state.wsPort ?? 3334)))
	app.get('/canvas', (c) => c.html(canvasPage(state.wsPort ?? 3334)))

	app.get('/panels', (c) => {
		return c.json({
			panels: [...state.panels.keys()],
		})
	})

	app.post('/panels', async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as { name?: string }
		const requested = body.name ?? `panel-${Date.now().toString(36)}`
		const panel = sanitizePanelName(requested)
		if (!panel) return c.json({ ok: false, error: 'invalid panel name' }, 400)
		if (state.panels.has(panel)) return c.json({ ok: true, panel })

		state.panels.set(panel, '')
		try {
			await persistPanelsToDisk(state.stateFilePath, state.panels)
			broadcastToClients({ type: 'panel_created', panel })
			return c.json({ ok: true, panel })
		} catch (error) {
			state.panels.delete(panel)
			return c.json({ ok: false, error: getErrorMessage(error) }, 500)
		}
	})

	app.patch('/panels/:name', async (c) => {
		const oldName = sanitizePanelName(c.req.param('name'))
		const body = (await c.req.json().catch(() => ({}))) as { newName?: string }
		const newName = sanitizePanelName(body.newName ?? '')

		if (!oldName || !newName) {
			return c.json({ ok: false, error: 'invalid panel name' }, 400)
		}
		if (!state.panels.has(oldName)) {
			return c.json({ ok: false, error: `panel "${oldName}" not found` }, 404)
		}
		if (state.panels.has(newName)) {
			return c.json({ ok: false, error: `panel "${newName}" already exists` }, 409)
		}

		const html = state.panels.get(oldName) ?? ''
		state.panels.delete(oldName)
		state.panels.set(newName, html)
		try {
			await persistPanelsToDisk(state.stateFilePath, state.panels)
			broadcastToClients({ type: 'panel_renamed', oldName, newName })
			return c.json({ ok: true, panel: newName })
		} catch (error) {
			state.panels.delete(newName)
			state.panels.set(oldName, html)
			return c.json({ ok: false, error: getErrorMessage(error) }, 500)
		}
	})

	app.delete('/panels/:name', async (c) => {
		const panel = sanitizePanelName(c.req.param('name'))
		if (!panel) return c.json({ ok: false, error: 'invalid panel name' }, 400)
		if (!state.panels.has(panel)) {
			return c.json({ ok: false, error: `panel "${panel}" not found` }, 404)
		}
		if (state.panels.size <= 1) {
			return c.json({ ok: false, error: 'cannot delete last panel' }, 400)
		}

		const previous = state.panels.get(panel) ?? ''
		state.panels.delete(panel)
		try {
			await persistPanelsToDisk(state.stateFilePath, state.panels)
			broadcastToClients({ type: 'panel_deleted', panel })
			return c.json({ ok: true, panel })
		} catch (error) {
			state.panels.set(panel, previous)
			return c.json({ ok: false, error: getErrorMessage(error) }, 500)
		}
	})

	app.post('/render', async (c) => {
		const body = await c.req.json<{ html: string; panel?: string }>()
		if (typeof body.html !== 'string') {
			return c.json({ ok: false, error: 'missing html field' }, 400)
		}

		const panel = sanitizePanelName(body.panel ?? 'default')
		if (!panel) return c.json({ ok: false, error: 'invalid panel name' }, 400)

		const existed = state.panels.has(panel)
		const previous = state.panels.get(panel)
		if (!existed) state.panels.set(panel, '')
		state.panels.set(panel, body.html)

		try {
			await persistPanelsToDisk(state.stateFilePath, state.panels)
			if (!existed) broadcastToClients({ type: 'panel_created', panel })
			broadcastToClients({ type: 'render', panel, html: body.html })
			return c.json({ ok: true, panel })
		} catch (error) {
			if (previous === undefined) {
				state.panels.delete(panel)
			} else {
				state.panels.set(panel, previous)
			}
			return c.json({ ok: false, error: getErrorMessage(error) }, 500)
		}
	})

	app.post('/push', async (c) => {
		const body = await c.req.json<{ panel?: string; path: string }>()
		if (!body.path) return c.json({ ok: false, error: 'missing path field' }, 400)

		const panel = sanitizePanelName(body.panel ?? 'default')
		if (!panel) return c.json({ ok: false, error: 'invalid panel name' }, 400)

		const html = state.panels.get(panel)
		if (html === undefined) {
			return c.json({ ok: false, error: `panel "${panel}" has no content` }, 404)
		}

		try {
			const filePath = resolveSafePath(state.cwd, body.path)
			await writeFile(filePath, html, 'utf-8')
			return c.json({ ok: true, path: filePath })
		} catch (error) {
			return c.json({ ok: false, error: getErrorMessage(error) }, toHttpStatus(error, 500))
		}
	})

	app.post('/pull', async (c) => {
		const body = await c.req.json<{ panel?: string; path: string }>()
		if (!body.path) return c.json({ ok: false, error: 'missing path field' }, 400)

		const panel = sanitizePanelName(body.panel ?? 'default')
		if (!panel) return c.json({ ok: false, error: 'invalid panel name' }, 400)

		const existed = state.panels.has(panel)
		const previous = state.panels.get(panel)
		try {
			const filePath = resolveSafePath(state.cwd, body.path)
			const html = await readFile(filePath, 'utf-8')
			if (!existed) state.panels.set(panel, '')
			state.panels.set(panel, html)
			await persistPanelsToDisk(state.stateFilePath, state.panels)
			if (!existed) broadcastToClients({ type: 'panel_created', panel })
			broadcastToClients({ type: 'render', panel, html })
			return c.json({ ok: true, panel, html })
		} catch (error) {
			if (previous === undefined) {
				state.panels.delete(panel)
			} else {
				state.panels.set(panel, previous)
			}
			return c.json({ ok: false, error: getErrorMessage(error) }, toHttpStatus(error, 500))
		}
	})

	app.get('/state', (c) => {
		const result: Record<string, string> = {}
		for (const [k, v] of state.panels) result[k] = v
		return c.json({ panels: result })
	})

	app.get('/screenshot', async (c) => {
		const width = clampInt(c.req.query('width'), 1280, 320, 3840)
		const height = clampInt(c.req.query('height'), 720, 240, 2160)
		const capture = state.captureScreenshot ?? captureScreenshotViaAgentBrowser
		const targetUrl = buildCanvasUrl({
			requestUrl: c.req.url,
			host: c.req.header('host'),
			forwardedHost: c.req.header('x-forwarded-host'),
			forwardedProto: c.req.header('x-forwarded-proto'),
		})

		try {
			const png = await capture(targetUrl, width, height)
			return new Response(new Blob([Buffer.from(png)]), {
				headers: {
					'Content-Type': 'image/png',
					'Cache-Control': 'no-store',
					'Content-Disposition': 'inline; filename="agent-canvas.png"',
				},
			})
		} catch (error) {
			return c.json({ ok: false, error: getErrorMessage(error) }, 503)
		}
	})

	return app
}

const wsClients = new Set<{ send: (data: string) => void }>()

export function addWsClient(ws: { send: (data: string) => void }) {
	wsClients.add(ws)
}

export function removeWsClient(ws: { send: (data: string) => void }) {
	wsClients.delete(ws)
}

function broadcastToClients(msg: unknown) {
	const data = JSON.stringify(msg)
	for (const client of wsClients) {
		try {
			client.send(data)
		} catch {
			wsClients.delete(client)
		}
	}
}

function ensureDefaultPanel(state: CanvasState) {
	if (!state.panels.has('default')) state.panels.set('default', '')
}

function sanitizePanelName(value: string): string | null {
	const name = value.trim()
	if (!name) return null
	if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name)) return null
	return name
}

function resolveSafePath(cwd: string, inputPath: string): string {
	const resolved = resolve(cwd, inputPath)
	const root = resolve(cwd)
	if (resolved === root || resolved.startsWith(`${root}${sep}`)) return resolved
	throw new Error('path must stay within project cwd')
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}

type ErrorStatus = 400 | 403 | 404 | 500

function toHttpStatus(error: unknown, fallback: ErrorStatus): ErrorStatus {
	const message = getErrorMessage(error)
	if (message.includes('path must stay within project cwd')) return 400
	if (hasErrorCode(error, 'ENOENT')) return 404
	if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) return 403
	return fallback
}

function hasErrorCode(error: unknown, code: string): boolean {
	if (typeof error !== 'object' || error === null) return false
	const candidate = error as { code?: string }
	return candidate.code === code
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	const parsed = Number.parseInt(raw ?? '', 10)
	if (Number.isNaN(parsed)) return fallback
	if (parsed < min) return min
	if (parsed > max) return max
	return parsed
}

function buildCanvasUrl(input: {
	requestUrl: string
	host?: string
	forwardedHost?: string
	forwardedProto?: string
}): string {
	const parsed = new URL(input.requestUrl)
	const host = input.forwardedHost || input.host || parsed.host
	const proto = input.forwardedProto || parsed.protocol.replace(':', '')
	return `${proto}://${host}/canvas`
}
