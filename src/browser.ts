/**
 * 在系统默认浏览器中打开文件/URL（跨平台，尽力而为）。
 */

import { spawn } from 'node:child_process'
import process from 'node:process'

export function openInBrowser(target: string): void {
  const command = process.platform === `darwin`
    ? `open`
    : process.platform === `win32`
      ? `cmd`
      : `xdg-open`

  const args = process.platform === `win32` ? [`/c`, `start`, ``, target] : [target]

  try {
    const child = spawn(command, args, { detached: true, stdio: `ignore` })
    child.on(`error`, () => {})
    child.unref()
  }
  catch {
    // 打开失败不影响主流程
  }
}
