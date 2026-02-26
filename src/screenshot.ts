// screenshot.ts — capture canvas screenshot via agent-browser CLI

import { readFile, unlink } from 'fs/promises'

export type ScreenshotCapture = (
	targetUrl: string,
	width: number,
	height: number,
) => Promise<Uint8Array>

export const captureScreenshotViaAgentBrowser: ScreenshotCapture = async (
	targetUrl,
	width,
	height,
) => {
	const session = `agent-canvas-shot-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 8)}`
	const outputPath = `/tmp/${session}.png`

	await ensureAgentBrowserAvailable()

	try {
		await runAgentBrowser(['--session', session, 'open', targetUrl])
		await runAgentBrowser([
			'--session',
			session,
			'set',
			'viewport',
			String(width),
			String(height),
		])
		await runAgentBrowser(['--session', session, 'wait', '800'])
		await runAgentBrowser(['--session', session, 'screenshot', outputPath])
		return new Uint8Array(await readFile(outputPath))
	} finally {
		await runAgentBrowser(['--session', session, 'close'], true)
		await unlink(outputPath).catch(() => undefined)
	}
}

async function ensureAgentBrowserAvailable(): Promise<void> {
	const result = await runCli(['agent-browser', '--help'], true)
	if (result.exitCode !== 0) {
		throw new Error('agent-browser CLI unavailable; cannot capture screenshot')
	}
}

async function runAgentBrowser(args: string[], allowFailure = false): Promise<void> {
	const result = await runCli(['agent-browser', ...args], allowFailure)
	if (allowFailure || result.exitCode === 0) return
	const detail = result.stderr || result.stdout || `exit ${result.exitCode}`
	throw new Error(`agent-browser failed: ${detail.trim()}`)
}

async function runCli(
	cmd: string[],
	allowFailure: boolean,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const process = Bun.spawn({
		cmd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [stdoutBytes, stderrBytes, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	])
	if (!allowFailure && exitCode !== 0) {
		return { exitCode, stdout: stdoutBytes, stderr: stderrBytes }
	}
	return { exitCode, stdout: stdoutBytes, stderr: stderrBytes }
}
