/**
 * 按文章记住「预览时使用的主题」，让 publish / copy 默认复用，
 * 实现「预览什么（主题）就发布什么」。
 *
 * 存储：与凭据同目录的 theme-memory.json（WELIGHT_HOME 可覆盖），
 * 键为 Markdown 文件的绝对路径。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type { WelightConfig } from './config'

function storeFile(): string {
  const home = (process.env.WELIGHT_HOME ?? ``).trim() || path.join(os.homedir(), `.config`, `welight`)
  return path.join(home, `theme-memory.json`)
}

function readMemory(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), `utf8`)) as Record<string, string>
  }
  catch {
    return {}
  }
}

/** 记录某篇文章预览时使用的主题 */
export function rememberTheme(filePath: string, theme: string): void {
  if (!filePath || filePath === `-` || !theme)
    return
  const abs = path.resolve(filePath)
  const map = readMemory()
  map[abs] = theme
  try {
    fs.mkdirSync(path.dirname(storeFile()), { recursive: true })
    fs.writeFileSync(storeFile(), `${JSON.stringify(map, null, 2)}\n`)
  }
  catch {
    // 记忆失败不影响主流程
  }
}

/** 读取某篇文章记忆的主题 */
export function recallTheme(filePath: string): string | undefined {
  if (!filePath || filePath === `-`)
    return undefined
  return readMemory()[path.resolve(filePath)]
}

/**
 * 解析一篇文章实际使用的主题：
 * 命令行 --theme > 该文件预览时记忆的主题 > 配置默认主题
 */
export function resolveArticleTheme(config: WelightConfig, filePath: string, flagTheme?: string): { theme: string, fromMemory: boolean } {
  const flag = (flagTheme ?? ``).trim()
  if (flag)
    return { theme: flag, fromMemory: false }
  const remembered = recallTheme(filePath)
  if (remembered)
    return { theme: remembered, fromMemory: true }
  return { theme: config.theme, fromMemory: false }
}
