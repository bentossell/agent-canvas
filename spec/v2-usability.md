# agent-canvas v2 usability spec

status: implemented

## Problem
Current tool works, but feels raw:
- New users do not understand "what this is" in first 10 seconds
- Panel lifecycle is client-only (add/rename/delete in UI can drift from server state)
- Push/pull uses prompt flow and weak errors

## Goal
Make the tool self-explanatory + reliable for agent/human collaboration.

## Scope

### 1) In-app onboarding (first-run clarity)
- Add "What is this" help drawer in toolbar
- Add copyable curl examples
- Add "Try demo" button that auto-renders sample panels

### 2) Server-backed panel lifecycle
- Add endpoints:
  - `GET /panels`
  - `POST /panels` (create)
  - `PATCH /panels/:name` (rename)
  - `DELETE /panels/:name` (delete)
- Broadcast ws events for create/rename/delete
- UI uses API instead of local-only mutation

### 3) Safer file path handling
- Restrict push/pull to cwd
- Return clear path violation errors

## API changes
- Existing endpoints unchanged: `/render`, `/push`, `/pull`, `/state`
- New panel endpoints for deterministic state sync

## Acceptance criteria
- User can open app and understand usage from UI only
- Adding/renaming/removing a panel updates server state deterministically
- `GET /panels` reflects UI and API actions consistently
- Push/pull rejects path traversal outside cwd
- tests pass + typecheck clean
