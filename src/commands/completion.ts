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
    .addHelpText(`after`, `\nTab 补全安装:\n  bash: eval "$(wl completion bash)"            # 可写入 ~/.bashrc\n  zsh : eval "$(wl completion zsh)"             # 可写入 ~/.zshrc（oh-my-zsh 之后）\n  fish: wl completion fish | source\n\n行内联想（输入时浅色候选，→ 采用）:\n  zsh : brew install zsh-autosuggestions\n        并在 ~/.zshrc 设置 ZSH_AUTOSUGGEST_STRATEGY=(completion)\n  fish: 原生支持（候选来自补全）\n  bash: 需 ble.sh（bash 行编辑器）`)
    .action((shell?: string) => {
      if (!shell) {
        process.stdout.write(
          [
            `用法：wl completion <bash|zsh|fish>`,
            `Tab 补全:`,
            `  bash: eval "$(wl completion bash)"`,
            `  zsh : eval "$(wl completion zsh)"   # 写入 ~/.zshrc（oh-my-zsh 之后）`,
            `  fish: wl completion fish | source`,
            `行内联想（浅色候选 + → 采用）:`,
            `  zsh : brew install zsh-autosuggestions，并在 ~/.zshrc 设 ZSH_AUTOSUGGEST_STRATEGY=(completion)`,
            `  fish: 原生支持；bash: 需 ble.sh`,
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
