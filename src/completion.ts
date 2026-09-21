/**
 * Shell 补全。
 *
 * - `wl completion bash|zsh|fish` 输出补全脚本；
 * - 脚本在补全时回调隐藏命令 `wl __complete <词...>`，由其给出候选。
 *
 * 不引入额外依赖，等价于 gh / cargo 等 CLI 的补全机制。
 */

import process from 'node:process'
import type { Command } from 'commander'
import { LAYOUT_TIER_SETTINGS } from './engine'
import { themeOptions } from './engine'
import { CREDENTIAL_ALIASES, CREDENTIAL_SPECS } from './credentials'
import { serviceOptions } from './modelPresets'

/** 需要枚举值的选项：长选项名（去掉 --）→ 候选生成器 */
const VALUE_PROVIDERS: Record<string, () => string[]> = {
  theme: () => themeOptions.map(option => option.value),
  provider: () => serviceOptions.filter(option => option.value !== `custom`).map(option => option.value),
  tier: () => [...LAYOUT_TIER_SETTINGS],
  'fail-on': () => [`none`, `low`, `medium`, `high`],
  'code-theme': () => [`github-dark`, `atom-one-light`, `github`, `none`],
  name: () => [...Object.keys(CREDENTIAL_SPECS), ...Object.keys(CREDENTIAL_ALIASES)],
}

function takesValue(option: { flags: string }): boolean {
  return /[<[].+[>\]]/.test(option.flags)
}

function findCommand(parent: Command, token: string): Command | undefined {
  return parent.commands.find(command => command.name() === token || command.aliases().includes(token))
}

function findOption(command: Command, token: string) {
  const flag = token.split(`=`)[0]
  return command.options.find(option => option.long === flag || option.short === flag)
}

/**
 * 根据已输入的词计算补全候选。
 * @param program 根命令
 * @param words 二进制名之后的词（含正在输入的最后一个词，可能为空串）
 */
export function completeSuggestions(program: Command, words: string[]): string[] {
  const current = words.length > 0 ? words[words.length - 1] : ``
  const prior = words.slice(0, -1)

  let command = program
  let expectValueFor: string | undefined

  for (const token of prior) {
    if (expectValueFor) {
      expectValueFor = undefined
      continue
    }
    if (token.startsWith(`-`)) {
      const option = findOption(command, token)
      if (option && takesValue(option))
        expectValueFor = option.long?.replace(/^--/, ``)
      continue
    }
    const sub = findCommand(command, token)
    if (sub)
      command = sub
  }

  // 上一个词是「需要枚举值」的选项
  if (expectValueFor) {
    const provider = VALUE_PROVIDERS[expectValueFor]
    if (!provider)
      return []
    return provider().filter(value => value.startsWith(current) && value !== current)
  }

  const candidates = new Set<string>()
  if (current.startsWith(`-`)) {
    for (const option of command.options) {
      if (option.long)
        candidates.add(option.long)
      if (option.short)
        candidates.add(option.short)
    }
  }
  else {
    for (const sub of command.commands) {
      if (sub.name().startsWith(`__`))
        continue
      candidates.add(sub.name())
      for (const alias of sub.aliases())
        candidates.add(alias)
    }
    for (const option of command.options) {
      if (option.long)
        candidates.add(option.long)
    }
  }

  return [...candidates].filter(value => value.startsWith(current) && value !== current).sort()
}

/** 注册隐藏的 __complete 命令（读取原始 argv，避免被解析器改写） */
export function registerCompletionCallback(program: Command): void {
  program
    .command(`__complete`, { hidden: true })
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .description(`（内部）输出补全候选`)
    .action(() => {
      const words = process.argv.slice(3)
      const suggestions = completeSuggestions(program, words)
      process.stdout.write(suggestions.length > 0 ? `${suggestions.join(`\n`)}\n` : ``)
    })
}

export function bashScript(): string {
  return `# Welight CLI bash 补全：eval "$(wl completion bash)"
_wl_complete() {
  local IFS=$'\\n'
  COMPREPLY=($("${'${COMP_WORDS[0]}'}" __complete "${'${COMP_WORDS[@]:1}'}" 2>/dev/null))
}
complete -o default -F _wl_complete wl
complete -o default -F _wl_complete welight
`
}

export function zshScript(): string {
  return `#compdef wl welight
# Welight CLI zsh 补全：wl completion zsh > "\${fpath[1]}/_wl"（然后重开终端）
_wl_complete() {
  local -a candidates
  candidates=("${'${(@f)$('}"${'${words[1]}'}" __complete "${'${(@)words[2,-1]}'}" 2>/dev/null)}")
  compadd -a candidates
}
compdef _wl_complete wl welight
`
}

export function fishScript(): string {
  return `# Welight CLI fish 补全：wl completion fish | source
function __wl_complete
  set -l tokens (commandline -opc)
  set -l current (commandline -ct)
  $tokens[1] __complete $tokens[2..-1] $current 2>/dev/null
end
complete -c wl -f -a '(__wl_complete)'
complete -c welight -f -a '(__wl_complete)'
`
}

export function completionScript(shell: string): string | undefined {
  if (shell === `bash`)
    return bashScript()
  if (shell === `zsh`)
    return zshScript()
  if (shell === `fish`)
    return fishScript()
  return undefined
}
