# agent-canvas v3 quality pass

status: implemented

## goal
Ship the three highest-impact improvements requested after v2:
1. screenshot endpoint
2. inline push/pull controls (no prompt modals)
3. persistent state across restarts

## scope

### 1) screenshot endpoint
- add `GET /screenshot`
- optional query: `width`, `height`
- return `image/png`
- expose UI button to download screenshot

### 2) inline push/pull controls
- add toolbar inputs for panel + file path
- replace prompt() flow with deterministic form actions
- show inline success/error feedback text

### 3) persistent state
- write state to `.agent-canvas/state.json` in cwd
- load on boot
- keep `default` panel guaranteed
- make render/panel lifecycle/pull changes persist

## acceptance
- restart server, state survives
- screenshot endpoint returns png (or clear 503 if capture unavailable)
- push/pull can be executed from toolbar without dialogs
- tests + typecheck pass
