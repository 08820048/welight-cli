/**
 * 终端实时 Markdown 渲染：随流式增量不断重绘已累积的内容。
 *
 * 做法：累积原文 → markdownToAnsi 渲染 → 用 ANSI 光标回退 + 清屏重画
 * 上一次占用的行。按 ~100ms 节流，避免每个 token 都重绘导致闪烁。
 * 仅在 TTY 使用；非 TTY 请直接输出原始文本。
 */

import process from 'node:process'
import { markdownToAnsi } from './markdown/ansi'
import { c } from './ui'

const ANSI_RE = /\u001B\[[0-9;]*[A-Z]/g

function visibleLength(text: string): number {
  return text.replace(ANSI_RE, ``).length
}

function terminalColumns(): number {
  const columns = process.stdout.columns
  return columns && columns > 0 ? columns : 80
}

function countLines(text: string, columns: number): number {
  const width = Math.max(20, columns)
  let lines = 0
  for (const line of text.split(`\n`))
    lines += Math.max(1, Math.ceil(visibleLength(line) / width))
  return lines
}

export function assistantLabel(): string {
  return `${c.cyan(`◆`)} ${c.bold(`WelightAI`)}`
}

export class LiveMarkdown {
  private buffer = ``
  private renderedLines = 0
  private started = false
  private lastPaint = 0

  constructor(private readonly label = assistantLabel()) {}

  /** 追加一段增量并（节流）重绘 */
  append(delta: string): void {
    this.buffer += delta
    const now = Date.now()
    if (now - this.lastPaint >= 100)
      this.paint()
  }

  private paint(): void {
    if (!this.started) {
      process.stdout.write(`${this.label}\n`)
      this.started = true
    }
    else if (this.renderedLines > 0) {
      // 回到上一次渲染的起始行并清空其下方内容
      process.stdout.write(`\u001B[${this.renderedLines}A\u001B[0J`)
    }
    const rendered = markdownToAnsi(this.buffer)
    process.stdout.write(`${rendered}\n`)
    this.renderedLines = countLines(rendered, terminalColumns())
    this.lastPaint = Date.now()
  }

  /** 结束流式：做最后一次渲染并空一行 */
  finish(): void {
    if (!this.started && !this.buffer)
      return
    this.paint()
    process.stdout.write(`\n`)
  }
}
