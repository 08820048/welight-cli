/**
 * 交互式输入（@clack/prompts）。
 * 密钥输入走 password，不回显、不进日志。
 */

import process from 'node:process'
import * as p from '@clack/prompts'

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/** 普通文本输入；取消返回 null */
export async function promptInput(message: string): Promise<string | null> {
  const value = await p.text({ message, placeholder: `输入内容，回车确认` })
  if (p.isCancel(value))
    return null
  return String(value).trim()
}

/** 密钥输入（不回显）；取消返回 null */
export async function promptSecret(message: string): Promise<string | null> {
  const value = await p.password({ message })
  if (p.isCancel(value))
    return null
  return String(value).trim()
}
