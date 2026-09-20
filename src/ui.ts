/**
 * 统一终端输出（picocolors）。
 */

import process from 'node:process'
import pc from 'picocolors'

export const c = pc

export const ui = {
  success(message: string): void {
    process.stdout.write(`${pc.green(`✔`)} ${message}\n`)
  },
  info(message: string): void {
    process.stdout.write(`${pc.cyan(`›`)} ${message}\n`)
  },
  warn(message: string): void {
    process.stderr.write(`${pc.yellow(`!`)} ${pc.yellow(message)}\n`)
  },
  error(message: string): void {
    process.stderr.write(`${pc.red(`✖`)} ${pc.red(message)}\n`)
  },
  title(message: string): void {
    process.stdout.write(`\n${pc.bold(message)}\n`)
  },
  dim(message: string): string {
    return pc.dim(message)
  },
  bold(message: string): string {
    return pc.bold(message)
  },
}

export type Severity = `high` | `medium` | `low`

export function severityTag(severity: Severity): string {
  if (severity === `high`)
    return pc.red(pc.bold(`高`))
  if (severity === `medium`)
    return pc.yellow(`中`)
  return pc.dim(`低`)
}

export function kv(label: string, value: string): string {
  return `  ${pc.dim(label.padEnd(18))} ${value}`
}

export function printKeyValues(rows: Array<[string, string]>): void {
  const width = Math.max(...rows.map(([label]) => label.length))
  for (const [label, value] of rows)
    process.stdout.write(`  ${pc.dim(label.padEnd(width))}  ${value}\n`)
}
