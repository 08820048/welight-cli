/**
 * 交互式启动器：直接运行 `wl`（无子命令）时，用 clack 选择一个命令并收集必填参数后执行。
 * 非交互环境请调用方改为输出 help。
 */

import process from 'node:process'
import type { Command } from 'commander'
import * as p from '@clack/prompts'
import { c } from './ui'

/** 排除内部/帮助命令后返回可选命令 */
export function selectableCommands(program: Command): Command[] {
  return program.commands.filter(command => !command.name().startsWith(`__`) && command.name() !== `help`)
}

async function collectArgument(argument: { name: () => string, description?: string, required: boolean, argChoices?: string[] }): Promise<string | null | undefined> {
  const name = argument.name()
  const hint = argument.description ? `（${argument.description}）` : ``

  if (argument.argChoices && argument.argChoices.length > 0) {
    const value = await p.select({
      message: `${name}${hint}`,
      options: argument.argChoices.map(choice => ({ value: choice, label: choice })),
    })
    return p.isCancel(value) ? null : String(value)
  }

  const value = await p.text({
    message: `${name}${argument.required ? `` : `（可选，回车跳过）`}${hint}`,
    placeholder: argument.description,
  })
  if (p.isCancel(value))
    return null
  const text = String(value).trim()
  if (!text)
    return argument.required ? undefined : ``
  return text
}

export async function runLauncher(program: Command): Promise<void> {
  const commands = selectableCommands(program)

  p.intro(c.bgCyan(c.black(` Welight CLI `)))

  const picked = await p.autocomplete({
    message: `选择要执行的命令`,
    options: commands.map(command => ({
      value: command.name(),
      label: command.name(),
      hint: command.description(),
    })),
  })
  if (p.isCancel(picked)) {
    p.outro(c.dim(`已取消`))
    return
  }

  const command = commands.find(item => item.name() === String(picked))
  if (!command) {
    p.outro(c.dim(`未找到命令`))
    return
  }

  const args: string[] = []
  for (const argument of command.registeredArguments) {
    const value = await collectArgument(argument)
    if (value === null) {
      p.outro(c.dim(`已取消`))
      return
    }
    if (value === undefined) {
      p.log.warn(`${argument.name()} 为必填，已取消`)
      return
    }
    if (value !== ``)
      args.push(value)
  }

  const commandLine = `wl ${command.name()}${args.length > 0 ? ` ${args.join(` `)}` : ``}`
  p.log.step(`执行：${commandLine}`)

  try {
    await command.parseAsync(args, { from: `user` })
  }
  catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
