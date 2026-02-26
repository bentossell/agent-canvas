// server.test.ts — tests for agent-canvas HTTP endpoints

import { describe, it, expect } from 'bun:test'
import { createApp, type CanvasState } from './server'
import type { ScreenshotCapture } from './screenshot'

interface TestStateOptions {
	cwd?: string
	captureScreenshot?: ScreenshotCapture
}

function makeState(options: TestStateOptions = {}): CanvasState {
	const cwd = options.cwd ?? '/tmp'
	return {
		panels: new Map(),
		wsPort: 9999,
		cwd,
		stateFilePath: `${cwd}/.agent-canvas-tests/state-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}.json`,
		captureScreenshot: options.captureScreenshot,
	}
}

function makeApp(options?: TestStateOptions) {
	const state = makeState(options)
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

	it('auto-creates named panel on render', async () => {
		const { app, state } = makeApp()
		const res = await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: '<p>sidebar</p>', panel: 'sidebar' }),
		})
		expect(res.status).toBe(200)
		expect(state.panels.get('sidebar')).toBe('<p>sidebar</p>')
	})

	it('rejects invalid panel name', async () => {
		const { app } = makeApp()
		const res = await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: '<h1>x</h1>', panel: '../evil' }),
		})
		expect(res.status).toBe(400)
	})

	it('persists state to disk after render', async () => {
		const cwd = `/tmp/agent-canvas-persist-${Date.now()}`
		const { app, state } = makeApp({ cwd })
		await app.request('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: '<h1>persisted</h1>', panel: 'default' }),
		})
		const raw = await Bun.file(state.stateFilePath).text()
		expect(raw).toContain('persisted')
		expect(raw).toContain('default')
	})
})

describe('panel lifecycle', () => {
	it('lists panels', async () => {
		const { app } = makeApp()
		const res = await app.request('/panels')
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.panels).toContain('default')
	})

	it('creates panel', async () => {
		const { app } = makeApp()
		const res = await app.request('/panels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'nav' }),
		})
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.panel).toBe('nav')
	})

	it('renames panel', async () => {
		const { app } = makeApp()
		await app.request('/panels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'old' }),
		})
		const res = await app.request('/panels/old', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newName: 'new' }),
		})
		expect(res.status).toBe(200)
	})

	it('deletes panel, but not last one', async () => {
		const { app } = makeApp()
		await app.request('/panels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'x' }),
		})
		const okRes = await app.request('/panels/x', { method: 'DELETE' })
		expect(okRes.status).toBe(200)
		const failRes = await app.request('/panels/default', { method: 'DELETE' })
		expect(failRes.status).toBe(400)
	})
})

describe('GET /canvas', () => {
	it('returns HTML page with inline push/pull form', async () => {
		const { app } = makeApp()
		const res = await app.request('/canvas')
		expect(res.status).toBe(200)
		const text = await res.text()
		expect(text).toContain('agent-canvas')
		expect(text).toContain('io-panel')
		expect(text).toContain('io-path')
		expect(text).toContain('What is this')
	})
})

describe('GET /', () => {
	it('returns canvas page', async () => {
		const { app } = makeApp()
		const res = await app.request('/')
		expect(res.status).toBe(200)
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

	it('rejects unknown panel', async () => {
		const { app } = makeApp()
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ panel: 'missing', path: '/tmp/test.html' }),
		})
		expect(res.status).toBe(404)
	})

	it('pushes panel content to file', async () => {
		const { app, state } = makeApp({ cwd: '/tmp' })
		state.panels.set('default', '<h1>saved</h1>')
		const tmpPath = `agent-canvas-test-${Date.now()}.html`
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: tmpPath }),
		})
		expect(res.status).toBe(200)
		const file = Bun.file(`/tmp/${tmpPath}`)
		const content = await file.text()
		expect(content).toBe('<h1>saved</h1>')
	})

	it('blocks path traversal', async () => {
		const { app, state } = makeApp({ cwd: '/tmp/agent-canvas-root' })
		state.panels.set('default', '<h1>saved</h1>')
		const res = await app.request('/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: '../escape.html' }),
		})
		expect(res.status).toBe(400)
	})
})

describe('POST /pull', () => {
	it('pulls file into panel', async () => {
		const { app, state } = makeApp({ cwd: '/tmp' })
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

	it('blocks path traversal', async () => {
		const { app } = makeApp({ cwd: '/tmp/agent-canvas-root' })
		const res = await app.request('/pull', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: '../escape.html' }),
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

describe('GET /screenshot', () => {
	it('returns png via injected screenshot capture', async () => {
		let calledUrl = ''
		let calledWidth = 0
		let calledHeight = 0
		const captureScreenshot: ScreenshotCapture = async (url, width, height) => {
			calledUrl = url
			calledWidth = width
			calledHeight = height
			return new Uint8Array([137, 80, 78, 71])
		}
		const { app } = makeApp({ captureScreenshot })
		const res = await app.request('/screenshot?width=900&height=600')
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('image/png')
		expect(calledUrl).toContain('/canvas')
		expect(calledWidth).toBe(900)
		expect(calledHeight).toBe(600)
	})

	it('returns 503 on screenshot failure', async () => {
		const captureScreenshot: ScreenshotCapture = async () => {
			throw new Error('capture failed')
		}
		const { app } = makeApp({ captureScreenshot })
		const res = await app.request('/screenshot')
		expect(res.status).toBe(503)
		const json = await res.json()
		expect(json.ok).toBe(false)
	})
})
