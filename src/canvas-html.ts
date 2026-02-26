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
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #111;
		border-bottom: 1px solid #333;
		font-size: 13px;
		flex-shrink: 0;
	}
	#toolbar .logo {
		font-weight: 600;
		color: #fff;
		margin-right: 12px;
	}
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
	#toolbar .status {
		margin-left: auto;
		font-size: 11px;
		color: #666;
	}
	#toolbar .status.connected { color: #4a4; }
	#panels {
		display: flex;
		flex: 1;
		overflow: hidden;
	}
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
	.panel-header .close-btn {
		cursor: pointer;
		color: #666;
		padding: 0 4px;
	}
	.panel-header .close-btn:hover { color: #f66; }
	.canvas-frame {
		flex: 1;
		border: none;
		background: #fff;
	}
	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #555;
		font-size: 14px;
		background: #fff;
	}
	#add-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		cursor: pointer;
		color: #555;
		font-size: 20px;
		flex-shrink: 0;
		border-left: 1px solid #333;
	}
	#add-panel:hover { color: #fff; background: #2a2a2a; }
</style>
</head>
<body>
<div id="toolbar">
	<span class="logo">◧ agent-canvas</span>
	<button onclick="pushToFile()">↑ Push</button>
	<button onclick="pullFromFile()">↓ Pull</button>
	<button onclick="addPanel()">+ Panel</button>
	<span id="status" class="status">connecting...</span>
</div>
<div id="panels">
	<div class="panel" data-panel="default">
		<div class="panel-header">
			<input value="default" onchange="renamePanel(this)" />
			<span class="close-btn" onclick="removePanel(this)">✕</span>
		</div>
		<div class="empty-state" data-empty="true">waiting for agent...</div>
	</div>
</div>

<script>
var WS_URL = (location.protocol === 'https:') ? ('wss://' + location.host + '/ws') : ('ws://' + location.hostname + ':${wsPort}');
let ws;
let reconnectTimer;
const panels = {};

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
		if (msg.type === 'render') {
			updatePanel(msg.panel || 'default', msg.html);
		}
	};
}

function updatePanel(name, html) {
	let panel = document.querySelector('[data-panel="' + name + '"]');
	if (!panel) {
		createPanel(name);
		panel = document.querySelector('[data-panel="' + name + '"]');
	}
	// Remove empty state if present
	const empty = panel.querySelector('[data-empty]');
	if (empty) empty.remove();
	// Get or create iframe
	let frame = panel.querySelector('iframe');
	if (!frame) {
		frame = document.createElement('iframe');
		frame.className = 'canvas-frame';
		frame.sandbox = 'allow-scripts allow-same-origin';
		panel.appendChild(frame);
	}
	frame.srcdoc = html;
	panels[name] = html;
}

function createPanel(name) {
	const container = document.getElementById('panels');
	const div = document.createElement('div');
	div.className = 'panel';
	div.dataset.panel = name;
	div.innerHTML =
		'<div class="panel-header">' +
		'<input value="' + name + '" onchange="renamePanel(this)" />' +
		'<span class="close-btn" onclick="removePanel(this)">✕</span>' +
		'</div>' +
		'<div class="empty-state" data-empty="true">waiting for agent...</div>';
	container.appendChild(div);
}

function addPanel() {
	const name = 'panel-' + Date.now().toString(36);
	createPanel(name);
}

function removePanel(btn) {
	const panel = btn.closest('.panel');
	const allPanels = document.querySelectorAll('.panel');
	if (allPanels.length <= 1) return; // keep at least one
	const name = panel.dataset.panel;
	delete panels[name];
	panel.remove();
}

function renamePanel(input) {
	const panel = input.closest('.panel');
	const oldName = panel.dataset.panel;
	const newName = input.value.trim() || oldName;
	if (panels[oldName]) {
		panels[newName] = panels[oldName];
		delete panels[oldName];
	}
	panel.dataset.panel = newName;
}

async function pushToFile() {
	const name = prompt('Panel name to push:', 'default');
	if (!name || !panels[name]) return;
	const path = prompt('Save to file path:');
	if (!path) return;
	const res = await fetch('/push', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ panel: name, path })
	});
	const data = await res.json();
	alert(data.ok ? 'Pushed to ' + path : 'Error: ' + data.error);
}

async function pullFromFile() {
	const path = prompt('Pull from file path:');
	if (!path) return;
	const name = prompt('Load into panel:', 'default');
	if (!name) return;
	const res = await fetch('/pull', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ panel: name, path })
	});
	const data = await res.json();
	if (data.ok) {
		updatePanel(name, data.html);
	} else {
		alert('Error: ' + data.error);
	}
}

connect();
</script>
</body>
</html>`
}
