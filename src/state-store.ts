// state-store.ts — load/persist panel state to disk

import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

interface StoredCanvasState {
	version: 1
	updatedAt: string
	panels: Record<string, string>
}

const PANEL_NAME_RE = /^[a-zA-Z0-9._-]{1,64}$/

export async function loadPanelsFromDisk(stateFilePath: string): Promise<Map<string, string>> {
	try {
		const raw = await readFile(stateFilePath, 'utf-8')
		const parsed = JSON.parse(raw) as Partial<StoredCanvasState>
		const panels = new Map<string, string>()
		for (const [name, html] of Object.entries(parsed.panels ?? {})) {
			if (PANEL_NAME_RE.test(name) && typeof html === 'string') {
				panels.set(name, html)
			}
		}
		return panels
	} catch (error: unknown) {
		if (isErrno(error, 'ENOENT')) return new Map<string, string>()
		throw error
	}
}

export async function persistPanelsToDisk(
	stateFilePath: string,
	panels: Map<string, string>,
): Promise<void> {
	await mkdir(dirname(stateFilePath), { recursive: true })
	const payload: StoredCanvasState = {
		version: 1,
		updatedAt: new Date().toISOString(),
		panels: Object.fromEntries(panels),
	}
	const tmpPath = `${stateFilePath}.tmp`
	await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
	await rename(tmpPath, stateFilePath)
}

function isErrno(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
