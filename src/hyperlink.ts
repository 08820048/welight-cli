/**
 * 终端超链接（OSC 8）：支持 Ctrl/Cmd + 单击在浏览器打开。
 * 不支持的终端自动降级为纯文本，避免出现乱码转义。
 */

import process from 'node:process'

/** 常见支持 OSC 8 的终端 */
function detectSupport(): boolean {
  const force = process.env.FORCE_HYPERLINK
  if (force === `0`)
    return false
  if (force === `1`)
    return true

  // 非交互输出（管道 / CI）不输出转义
  if (!process.stdout.isTTY)
    return false

  const env = process.env
  if (env.WT_SESSION || env.KITTY_WINDOW_ID || env.GHOSTTY_RESOURCES_DIR)
    return true
  if (env.TERM_PROGRAM && [`iTerm.app`, `WezTerm`, `vscode`, `ghostty`, `Hyper`, `Tabby`, `mintty`].includes(env.TERM_PROGRAM))
    return true
  if (env.LC_TERMINAL && /iTerm/i.test(env.LC_TERMINAL))
    return true
  if (env.TERM && [`xterm-kitty`, `xterm-ghostty`, `wezterm`].includes(env.TERM))
    return true
  if (env.VTE_VERSION && Number(env.VTE_VERSION) >= 5000)
    return true

  return false
}

let cached: boolean | undefined

export function supportsHyperlinks(): boolean {
  cached ??= detectSupport()
  return cached
}

/** 用 OSC 8 包裹文本；不支持时返回纯文本 */
export function link(text: string, url: string): string {
  if (!supportsHyperlinks())
    return text
  return `\u001B]8;;${url}\u001B\\${text}\u001B]8;;\u001B\\`
}
