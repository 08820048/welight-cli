/**
 * CLI 启动页：左侧命令导航，右侧产品 logo。
 * 描述列宽按终端宽度动态计算；窄终端自动退化为上下堆叠布局。
 */

import process from 'node:process'
import type { Command } from 'commander'
import { c } from './ui'

const ANSI_RE = /\u001B\[[0-9;]*[A-Za-z]/g
/** 近似双宽字符（CJK / 全角） */
const WIDE_RE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u3000-\u303F]/

export function displayWidth(text: string): number {
  const plain = text.replace(ANSI_RE, ``)
  let width = 0
  for (const char of plain)
    width += WIDE_RE.test(char) ? 2 : 1
  return width
}

function padEnd(text: string, width: number): string {
  const diff = width - displayWidth(text)
  return diff > 0 ? text + ` `.repeat(diff) : text
}

function truncate(text: string, width: number): string {
  if (displayWidth(text) <= width)
    return text
  let out = ``
  let current = 0
  for (const char of text) {
    const charWidth = WIDE_RE.test(char) ? 2 : 1
    if (current + charWidth > width - 1)
      break
    out += char
    current += charWidth
  }
  return `${out}…`
}

const LOGO = [
  `██╗    ██╗███████╗██╗     ██╗ ██████╗ ██╗  ██╗████████╗`,
  `██║    ██║██╔════╝██║     ██║██╔════╝ ██║  ██║╚══██╔══╝`,
  `██║ █╗ ██║█████╗  ██║     ██║██║  ███╗███████║   ██║   `,
  `██║███╗██║██╔══╝  ██║     ██║██║   ██║██╔══██║   ██║   `,
  `╚███╔███╔╝███████╗███████╗██║╚██████╔╝██║  ██║   ██║   `,
  ` ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   `,
]

const GROUPS: Array<{ title: string, items: string[] }> = [
  { title: `创作`, items: [`chat`, `render`, `layout`, `copy`, `publish`] },
  { title: `质量`, items: [`lint`, `checkup`, `detect`, `title`] },
  { title: `配置`, items: [`setup`, `model`, `auth`, `config`] },
  { title: `其它`, items: [`themes`, `doctor`, `init`, `completion`] },
]

const NAME_WIDTH = Math.max(...GROUPS.flatMap(group => group.items.map(name => name.length)))
const MIN_DESC_WIDTH = 14

function terminalColumns(): number {
  const columns = process.stdout.columns
  return columns && columns > 0 ? columns : 100
}

function leftColumn(program: Command, descWidth: number): string[] {
  const describe = (name: string): string => program.commands.find(item => item.name() === name)?.description() ?? ``
  const lines: string[] = []
  for (const group of GROUPS) {
    lines.push(c.bold(group.title))
    for (const name of group.items)
      lines.push(`  ${c.cyan(padEnd(name, NAME_WIDTH))}  ${c.dim(truncate(describe(name), descWidth))}`)
    lines.push(``)
  }
  while (lines.length > 0 && lines[lines.length - 1] === ``)
    lines.pop()
  return lines
}

function rightColumn(version: string): string[] {
  return [
    ...LOGO.map(line => c.cyan(line)),
    ``,
    `${c.bold(` Welight CLI`)}${c.dim(`  v${version}`)}`,
    c.dim(` 微信公众号 Markdown 排版与发布`),
    c.dim(` 免费开源 · 全部 BYOK`),
    ``,
    c.dim(` github.com/08820048/welight-cli`),
  ]
}

function frame(left: string[], right: string[]): string[] {
  const leftWidth = Math.max(...left.map(displayWidth))
  const rightWidth = Math.max(...right.map(displayWidth))
  const rows = Math.max(left.length, right.length)
  const inner = leftWidth + 3 + rightWidth
  const border = (value: string) => c.dim(value)

  const out: string[] = []
  out.push(border(`╭${`─`.repeat(inner + 2)}╮`))
  for (let index = 0; index < rows; index += 1) {
    const leftLine = padEnd(left[index] ?? ``, leftWidth)
    const rightLine = padEnd(right[index] ?? ``, rightWidth)
    out.push(`${border(`│`)} ${leftLine}   ${rightLine} ${border(`│`)}`)
  }
  out.push(border(`╰${`─`.repeat(inner + 2)}╯`))
  return out
}

function stacked(left: string[], right: string[]): string[] {
  const width = Math.max(...[...left, ...right].map(displayWidth))
  const center = (line: string): string => {
    const pad = Math.max(0, Math.floor((width - displayWidth(line)) / 2))
    return `${` `.repeat(pad)}${line}`
  }
  return [...right.map(center), ``, ...left]
}

export function welcomeScreen(program: Command, version: string): string {
  const columns = terminalColumns()
  const right = rightColumn(version)
  const rightWidth = Math.max(...right.map(displayWidth))

  // 分栏模式需要的最小左列宽度：名字 + 一段最小描述
  const leftWidthForColumns = NAME_WIDTH + 4 + Math.max(MIN_DESC_WIDTH, 20)
  const useColumns = columns >= leftWidthForColumns + rightWidth + 6

  let body: string[]
  if (useColumns) {
    const availableLeft = columns - rightWidth - 7
    const descWidth = Math.max(MIN_DESC_WIDTH, Math.min(48, availableLeft - NAME_WIDTH - 4))
    body = frame(leftColumn(program, descWidth), right)
  }
  else {
    body = stacked(leftColumn(program, Math.max(MIN_DESC_WIDTH, Math.min(60, columns - NAME_WIDTH - 8))), right)
  }

  const tip = `${c.dim(`运行 `)}${c.cyan(`wl <命令> --help`)}${c.dim(` 查看用法 · `)}${c.cyan(`wl chat`)}${c.dim(` 打开 AI 对话`)}`
  return `\n${body.join(`\n`)}\n\n${tip}\n`
}

export function printWelcome(program: Command, version: string): void {
  process.stdout.write(welcomeScreen(program, version))
}
