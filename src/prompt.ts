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
export async function askText(message: string, placeholder?: string, initialValue?: string): Promise<string | null> {
  const value = await p.text({ message, placeholder, initialValue })
  if (p.isCancel(value))
    return null
  return String(value).trim()
}

/** 密钥输入（不回显）；取消返回 null */
export async function askPassword(message: string): Promise<string | null> {
  const value = await p.password({ message })
  if (p.isCancel(value))
    return null
  return String(value).trim()
}

/** 是否确认；取消返回 false */
export async function askConfirm(message: string, initialValue = true): Promise<boolean> {
  const value = await p.confirm({ message, initialValue })
  if (p.isCancel(value))
    return false
  return Boolean(value)
}

export interface SelectOption {
  value: string
  label: string
  hint?: string
}

/** 单选；取消返回 null */
export async function askSelect(message: string, options: SelectOption[], initialValue?: string): Promise<string | null> {
  const value = await p.select({
    message,
    options: options.map(option => ({ value: option.value, label: option.label, hint: option.hint })),
    initialValue,
  })
  if (p.isCancel(value))
    return null
  return String(value)
}

/** 兼容旧调用名 */
export const promptInput = askText
export const promptSecret = askPassword
