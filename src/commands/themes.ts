import process from 'node:process'
import type { Command } from 'commander'
import { themeOptions } from '../engine'
import { note, presentCommand } from '../present'
import { c } from '../ui'

type ThemeList = typeof themeOptions

export function registerThemes(program: Command): void {
  program
    .command(`themes`)
    .description(`列出 CLI 可用的免费主题`)
    .action(async () => {
      await presentCommand<ThemeList>({
        run: async () => themeOptions,
        view: (data) => {
          const lines = data.map(theme => `${c.cyan(theme.value.padEnd(6))} ${theme.label.padEnd(8)} ${c.dim(theme.desc)}`)
          note(`可用免费主题（${data.length} 套）`, [...lines, ``, c.dim(`全部主题的前 45%；完整主题库请使用 Welight 桌面端。`)])
        },
        plain: (data) => {
          process.stdout.write(`可用免费主题（全部主题的前 45%）\n`)
          for (const theme of data)
            process.stdout.write(`  ${theme.value}  ${theme.label}  ${c.dim(theme.desc)}\n`)
          process.stdout.write(`\n${c.dim(`共 ${data.length} 套。完整主题库请使用 Welight 桌面端。`)}\n`)
        },
      })
    })
}
