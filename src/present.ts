/**
 * 命令呈现层（@clack/prompts + picocolors）。
 *
 * - 交互终端：spinner + clack note/log 呈现结果；
 * - 非交互（管道 / CI / --json）：直接 run 后走 plain 输出，保证可重定向。
 */

import process from 'node:process'
import * as p from '@clack/prompts'
import { isInteractive } from './prompt'
import { c, printKeyValues, ui } from './ui'

export interface PresentOptions<T> {
  run: (progress: (message: string) => void) => Promise<T>
  /** TTY 下的呈现（clack） */
  view?: (data: T) => void
  /** 非 TTY / 管道下的纯文本输出 */
  plain: (data: T) => void
  /** spinner 文案 */
  spinner?: string
}

/** 执行并呈现一个命令，返回数据（失败返回 undefined） */
export async function presentCommand<T>(options: PresentOptions<T>): Promise<T | undefined> {
  if (!isInteractive()) {
    const progress = (message: string) => process.stderr.write(`${c.dim(`· ${message}`)}\n`)
    try {
      const data = await options.run(progress)
      options.plain(data)
      return data
    }
    catch (error) {
      ui.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return undefined
    }
  }

  const spinner = p.spinner()
  spinner.start(options.spinner ?? `处理中…`)
  const progress = (message: string) => spinner.message(message)

  let data: T
  try {
    data = await options.run(progress)
  }
  catch (error) {
    spinner.stop(`出错`)
    ui.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return undefined
  }
  spinner.stop(`完成`)
  if (options.view)
    options.view(data)
  else
    options.plain(data)
  return data
}

/** clack note：标题 + 多行内容 */
export function note(title: string, lines: string[]): void {
  p.note(lines.join(`\n`), title)
}

/** 键值对（保留顺序），返回可直接放入 note 的行 */
export function kvLines(rows: Array<[string, string]>): string[] {
  return rows.map(([key, value]) => `${c.dim(key.padEnd(14))} ${value}`)
}

/** 直接在 TTY 打印键值对（不走 note） */
export function printKv(rows: Array<[string, string]>): void {
  printKeyValues(rows)
}

export { p }
