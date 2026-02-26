// server.test.ts — tests for agent-canvas HTTP endpoints

import { describe, it, expect, beforeEach } from 'bun:test'
import { createApp, type CanvasState } from './server'

function makeState(): CanvasState {
	return {
		panels: new Map(),
		wsPort: 9999,
		cwd: '/tmp',
	}
}

function makeApp() {
	const state = makeState()
	const app = createApp(state)
	return { app, state }
}

describe('POST /render', () => {
	it('renders HTML to default panel', async () => {
		const { app, state } = makeApp()
		const res = await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: '<h1>test</h1>' }),
		})
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.panel).toBe('default')
		expect(state.panels.get('default')).toBe('<h1>test</h1>')
	})

	it('renders to named panel', async () => {
		const { app, state } = makeApp()
		const res = await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: '<p>sidebar</p>', panel: 'sidebar' }),
		})
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.panel).toBe('sidebar')
		expect(state.panels.get('sidebar')).toBe('<p>sidebar</p>')
	})

	it('rejects missing html', async () => {
		const { app } = makeApp()
		const res = await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(400)
	})
})

describe('GET /canvas', () => {
	it('returns HTML page', async () => {
		const { app } = makeApp()
		const res = await app.request('/canvas')
		expect(res.status).toBe(200)
		const text = await res.text()
		expect(text).toContain('agent-canvas')
		expect(text).toContain('WebSocket')
	})
})

describe('GET /', () => {
	it('returns canvas page', async () => {
		const { app } = makeApp()
		const res = await app.request('/')
		expect(res.status).toBe(200)
		const text = await res.text()
		expect(text).toContain('agent-canvas')
	})
})

describe('POST /push', () => {
	it('rejects missing path', async () => {
		const { app } = makeApp()
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ panel: 'default' }),
		})
		expect(res.status).toBe(400)
	})

	it('rejects empty panel', async () => {
		const { app } = makeApp()
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: '/tmp/test.html' }),
		})
		expect(res.status).toBe(404)
	})

	it('pushes panel content to file', async () => {
		const { app, state } = makeApp()
		state.panels.set('default', '<h1>saved</h1>')
		const tmpPath = `/tmp/agent-canvas-test-${Date.now()}.html`
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: tmpPath }),
		})
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.ok).toBe(true)
		// Verify file was written
		const file = Bun.file(tmpPath)
		const content = await file.text()
		expect(content).toBe('<h1>saved</h1>')
		// Cleanup
		await Bun.write(tmpPath, '') // can't delete easily, just empty it
	})
})

describe('POST /pull', () => {
	it('pulls file into panel', async () => {
		const { app, state } = makeApp()
		const tmpPath = `/tmp/agent-canvas-pull-${Date.now()}.html`
		await Bun.write(tmpPath, '<div>pulled content</div>')
		const res = await app.request('/pull', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: tmpPath }),
		})
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.html).toBe('<div>pulled content</div>')
		expect(state.panels.get('default')).toBe('<div>pulled content</div>')
	})

	it('rejects missing path', async () => {
		const { app } = makeApp()
		const res = await app.request('/pull', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(400)
	})
})

describe('GET /state', () => {
	it('returns all panels', async () => {
		const { app, state } = makeApp()
		state.panels.set('a', '<p>a</p>')
		state.panels.set('b', '<p>b</p>')
		const res = await app.request('/state')
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.panels.a).toBe('<p>a</p>')
		expect(json.panels.b).toBe('<p>b</p>')
	})
})
