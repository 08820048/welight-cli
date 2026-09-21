import process from 'node:process'
import type { Command } from 'commander'
import { completionScript, registerCompletionCallback } from '../completion'
import { ui } from '../ui'

export function registerCompletion(program: Command): void {
  // 隐藏的补全回调命令
  registerCompletionCallback(program)

  program
    .command(`completion`)
    .description(`输出 shell 补全脚本（bash | zsh | fish）`)
    .argument(`[shell]`, `bash | zsh | fish`)
    .addHelpText(`after`, `\n安装:\n  bash: eval "$(wl completion bash)"           # 可写入 ~/.bashrc\n  zsh : wl completion zsh > "\${fpath[1]}/_wl"  # 然后重开终端\n  fish: wl completion fish | source\n\n安装后输入 wl 后按 Tab 可联想子命令、选项与枚举值。`)
    .action((shell?: string) => {
      if (!shell) {
        process.stdout.write(
          [
            `用法：wl completion <bash|zsh|fish>`,
            `  bash: eval "$(wl completion bash)"`,
            `  zsh : wl completion zsh > "\${fpath[1]}/_wl"   # 然后重开终端`,
            `  fish: wl completion fish | source`,
            ``,
          ].join(`\n`),
        )
        return
      }
      const script = completionScript(shell)
      if (!script) {
        ui.error(`不支持的 shell：${shell}（可用 bash / zsh / fish）`)
        process.exitCode = 1
        return
      }
      process.stdout.write(script)
    })
}
