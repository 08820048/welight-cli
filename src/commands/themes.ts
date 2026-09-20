import process from 'node:process'
import type { Command } from 'commander'
import { themeOptions } from '../engine'
import { ui } from '../ui'

export function registerThemes(program: Command): void {
  program
    .command(`themes`)
    .description(`列出 CLI 可用的免费主题`)
    .addHelpText(`after`, `\nCLI 只提供全部主题的前 45%；完整主题库请使用 Welight 桌面端。`)
    .action(() => {
      ui.title(`可用免费主题`)
      for (const option of themeOptions)
        process.stdout.write(`  ${option.value}  ${option.label}  ${ui.dim(option.desc)}\n`)
      process.stdout.write(`\n${ui.dim(`共 ${themeOptions.length} 套`)}\n`)
    })
}
