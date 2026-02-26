// canvas-html.ts — serves the canvas page as a single HTML string
// No build step, no framework. WebSocket client inline.

export function canvasPage(wsPort: number): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>agent-canvas</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: #1a1a1a;
		color: #e0e0e0;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
	#toolbar {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 12px;
		background: #111;
		border-bottom: 1px solid #333;
		font-size: 13px;
		flex-shrink: 0;
	}
	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
	}
	#toolbar .logo { font-weight: 600; color: #fff; margin-right: 12px; }
	#toolbar button {
		background: #2a2a2a;
		border: 1px solid #444;
		color: #ccc;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}
	#toolbar button:hover { background: #3a3a3a; color: #fff; }
	#toolbar input {
		background: #0f1116;
		border: 1px solid #2d3441;
		color: #c8d1e3;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		height: 28px;
	}
	#toolbar input:focus {
		outline: none;
		border-color: #5066a0;
	}
	.io-panel-input { width: 140px; }
	.io-path-input { min-width: 280px; flex: 1; }
	.io-label {
		font-size: 11px;
		color: #7d8698;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	#io-result {
		font-size: 11px;
		color: #7d8698;
		max-width: 380px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	#io-result.error { color: #ef7575; }
	#toolbar .status { margin-left: auto; font-size: 11px; color: #666; }
	#toolbar .status.connected { color: #4a4; }
	#panels { display: flex; flex: 1; overflow: hidden; }
	.panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-right: 1px solid #333;
		min-width: 200px;
	}
	.panel:last-child { border-right: none; }
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		background: #1e1e1e;
		border-bottom: 1px solid #333;
		font-size: 11px;
		color: #888;
	}
	.panel-header input {
		background: transparent;
		border: none;
		color: #aaa;
		font-size: 11px;
		width: 120px;
		outline: none;
	}
	.panel-header .close-btn { cursor: pointer; color: #666; padding: 0 4px; }
	.panel-header .close-btn:hover { color: #f66; }
	.canvas-frame { flex: 1; border: none; background: #fff; }
	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #555;
		font-size: 14px;
		background: #fff;
		text-align: center;
		padding: 20px;
	}
	#help {
		position: fixed;
		top: 80px;
		right: 12px;
		width: 450px;
		max-width: calc(100vw - 24px);
		max-height: calc(100vh - 92px);
		overflow: auto;
		background: #101114;
		border: 1px solid #2b2f38;
		border-radius: 8px;
		padding: 12px;
		display: none;
		z-index: 20;
		box-shadow: 0 8px 30px rgba(0,0,0,0.4);
	}
	#help h3 { font-size: 14px; margin-bottom: 8px; color: #fff; }
	#help p { font-size: 12px; line-height: 1.5; color: #b8beca; margin-bottom: 8px; }
	#help pre {
		background: #0a0b0f;
		border: 1px solid #232835;
		padding: 8px;
		border-radius: 6px;
		font-size: 11px;
		color: #90a9ff;
		overflow: auto;
		margin-bottom: 8px;
	}
</style>
</head>
<body>
<div id="toolbar">
	<div class="toolbar-row">
		<span class="logo">◧ agent-canvas</span>
		<button onclick="addPanel()">+ Panel</button>
		<button onclick="runDemo()">▶ Try demo</button>
		<button onclick="downloadScreenshot()">📸 Screenshot</button>
		<button onclick="toggleHelp()">? What is this</button>
		<span id="status" class="status">connecting...</span>
	</div>
	<div class="toolbar-row">
		<span class="io-label">panel <input id="io-panel" class="io-panel-input" value="default" /></span>
		<span class="io-label">path <input id="io-path" class="io-path-input" value="./tmp/canvas.html" /></span>
		<button onclick="pushToFile()">↑ Push</button>
		<button onclick="pullFromFile()">↓ Pull</button>
		<span id="io-result"></span>
	</div>
</div>
<div id="help">
	<h3>what this is</h3>
	<p>Your agent sends HTML to <code>/render</code>. This page renders it instantly in panel iframes.</p>
	<pre id="cmd-render">curl -X POST http://localhost:3333/render -H "Content-Type: application/json" -d '{"html":"<h1>Hello</h1>","panel":"default"}'</pre>
	<p>Use the inline panel/path fields in toolbar for push/pull (no prompts).</p>
	<pre>curl -X POST http://localhost:3333/push -H "Content-Type: application/json" -d '{"panel":"default","path":"./hero.html"}'</pre>
	<p>Screenshot endpoint: <code>GET /screenshot?width=1280&height=720</code></p>
	<p>Panel names must match: letters, numbers, dots, underscores, hyphens.</p>
</div>
<div id="panels"></div>

<script>
var WS_URL = (location.protocol === 'https:') ? ('wss://' + location.host + '/ws') : ('ws://' + location.hostname + ':${wsPort}');
let ws;
let reconnectTimer;
const panelCache = {};

function panelSelector(name) {
	return '[data-panel="' + CSS.escape(name) + '"]';
}

function getPanelInput() { return document.getElementById('io-panel'); }
function getPathInput() { return document.getElementById('io-path'); }
function getIoResult() { return document.getElementById('io-result'); }

function setIoResult(text, isError) {
	const el = getIoResult();
	el.textContent = text;
	el.className = isError ? 'error' : '';
}

function createPanel(name) {
	if (document.querySelector(panelSelector(name))) return;
	const container = document.getElementById('panels');
	const div = document.createElement('div');
	div.className = 'panel';
	div.dataset.panel = name;
	div.innerHTML =
		'<div class="panel-header">' +
		'<input value="' + name + '" data-prev="' + name + '" onchange="renamePanel(this)" />' +
		'<span class="close-btn" onclick="removePanel(this)">✕</span>' +
		'</div>' +
		'<div class="empty-state" data-empty="true">waiting for agent...</div>';
	container.appendChild(div);
}

function removePanelDom(name) {
	const panel = document.querySelector(panelSelector(name));
	if (panel) panel.remove();
	delete panelCache[name];
	if (getPanelInput().value === name) getPanelInput().value = 'default';
}

function renamePanelDom(oldName, newName) {
	const panel = document.querySelector(panelSelector(oldName));
	if (!panel) return;
	panel.dataset.panel = newName;
	const input = panel.querySelector('input');
	if (input) {
		input.value = newName;
		input.dataset.prev = newName;
	}
	if (panelCache[oldName] !== undefined) {
		panelCache[newName] = panelCache[oldName];
		delete panelCache[oldName];
	}
	if (getPanelInput().value === oldName) getPanelInput().value = newName;
}

function updatePanel(name, html) {
	let panel = document.querySelector(panelSelector(name));
	if (!panel) {
		createPanel(name);
		panel = document.querySelector(panelSelector(name));
	}
	const empty = panel.querySelector('[data-empty]');
	if (empty) empty.remove();
	let frame = panel.querySelector('iframe');
	if (!frame) {
		frame = document.createElement('iframe');
		frame.className = 'canvas-frame';
		frame.sandbox = 'allow-scripts allow-same-origin';
		panel.appendChild(frame);
	}
	frame.srcdoc = html || '<div class="empty-state">waiting for agent...</div>';
	panelCache[name] = html;
}

async function loadInitialState() {
	const panelRes = await fetch('/panels');
	const panelJson = await panelRes.json();
	for (const name of panelJson.panels || []) createPanel(name);
	const stateRes = await fetch('/state');
	const state = await stateRes.json();
	for (const [name, html] of Object.entries(state.panels || {})) {
		if ((html || '').length > 0) updatePanel(name, html);
	}
}

function connect() {
	ws = new WebSocket(WS_URL);
	ws.onopen = () => {
		document.getElementById('status').textContent = '● connected';
		document.getElementById('status').className = 'status connected';
	};
	ws.onclose = () => {
		document.getElementById('status').textContent = '○ disconnected';
		document.getElementById('status').className = 'status';
		clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(connect, 1000);
	};
	ws.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.type === 'render') updatePanel(msg.panel || 'default', msg.html);
		if (msg.type === 'panel_created') createPanel(msg.panel);
		if (msg.type === 'panel_deleted') removePanelDom(msg.panel);
		if (msg.type === 'panel_renamed') renamePanelDom(msg.oldName, msg.newName);
	};
}

function sanitizeName(name) {
	return /^[a-zA-Z0-9._-]{1,64}$/.test(name || '');
}

async function addPanel() {
	const requested = 'panel-' + Date.now().toString(36);
	const res = await fetch('/panels', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: requested })
	});
	const data = await res.json();
	if (!data.ok) return setIoResult(data.error || 'failed to create panel', true);
	getPanelInput().value = data.panel;
	setIoResult('created panel: ' + data.panel, false);
}

async function removePanel(btn) {
	const panel = btn.closest('.panel');
	if (!panel) return;
	const name = panel.dataset.panel;
	const res = await fetch('/panels/' + encodeURIComponent(name), { method: 'DELETE' });
	const data = await res.json();
	if (!data.ok) return setIoResult(data.error || 'failed to delete panel', true);
	setIoResult('deleted panel: ' + name, false);
}

async function renamePanel(input) {
	const oldName = input.dataset.prev || input.value;
	const newName = (input.value || '').trim();
	if (!sanitizeName(newName)) {
		setIoResult('invalid panel name', true);
		input.value = oldName;
		return;
	}
	if (oldName === newName) return;
	const res = await fetch('/panels/' + encodeURIComponent(oldName), {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ newName })
	});
	const data = await res.json();
	if (!data.ok) {
		setIoResult(data.error || 'failed to rename panel', true);
		input.value = oldName;
		return;
	}
	input.dataset.prev = newName;
	setIoResult('renamed panel to: ' + newName, false);
}

async function pushToFile() {
	const panel = getPanelInput().value.trim();
	const path = getPathInput().value.trim();
	if (!panel || !path) return setIoResult('panel + path required', true);
	const res = await fetch('/push', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ panel, path })
	});
	const data = await res.json();
	if (!data.ok) return setIoResult(data.error || 'push failed', true);
	setIoResult('pushed ' + panel + ' → ' + path, false);
}

async function pullFromFile() {
	const panel = getPanelInput().value.trim();
	const path = getPathInput().value.trim();
	if (!panel || !path) return setIoResult('panel + path required', true);
	const res = await fetch('/pull', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ panel, path })
	});
	const data = await res.json();
	if (!data.ok) return setIoResult(data.error || 'pull failed', true);
	setIoResult('pulled ' + path + ' → ' + panel, false);
}

function toggleHelp() {
	const help = document.getElementById('help');
	help.style.display = help.style.display === 'block' ? 'none' : 'block';
}

async function runDemo() {
	const steps = [
		{ panel: 'default', html: '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);font-family:sans-serif;color:white"><div style="text-align:center"><h1 style="font-size:52px;margin:0 0 12px">agent-canvas</h1><p style="font-size:22px;opacity:.9">Agent writes HTML. Browser renders live.</p></div></div>' },
		{ panel: 'nav', html: '<nav style="display:flex;justify-content:space-between;padding:16px 24px;background:#111;color:#fff;font-family:sans-serif"><b>◧ agent-canvas</b><span style="color:#9aa">Docs · API · GitHub</span></nav>' },
		{ panel: 'features', html: '<div style="padding:28px;background:#0b0b0b;color:#ddd;font-family:sans-serif"><h2 style="margin:0 0 16px">Why this exists</h2><ul style="line-height:1.7"><li>Live preview from agent output</li><li>No desktop app required</li><li>Push/pull with filesystem</li></ul></div>' }
	]
	for (const step of steps) {
		await fetch('/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(step)
		});
		await new Promise((resolve) => setTimeout(resolve, 450));
	}
	setIoResult('demo rendered across 3 panels', false);
}

async function downloadScreenshot() {
	setIoResult('capturing screenshot...', false);
	const res = await fetch('/screenshot?width=1280&height=720');
	if (!res.ok) {
		const data = await res.json().catch(() => ({ error: 'screenshot failed' }));
		return setIoResult(data.error || 'screenshot failed', true);
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'agent-canvas.png';
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
	setIoResult('screenshot downloaded', false);
}

loadInitialState().finally(connect);
</script>
</body>
</html>`
}
