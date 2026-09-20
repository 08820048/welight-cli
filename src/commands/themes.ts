import { Command } from 'clipanion'
import { themeOptions } from '../engine'

export class ThemesCommand extends Command {
  static paths = [[`themes`]]

  static usage = Command.Usage({
    description: `列出 CLI 可用的免费主题`,
    examples: [[`列出主题`, `$0 themes`]],
  })

  async execute(): Promise<number> {
    const lines = themeOptions.map(option => `  ${option.value}  ${option.label}  ${option.desc}`)
    this.context.stdout.write(
      [
        `CLI 可用免费主题（全部主题的前 45%）：`,
        ...lines,
        ``,
        `共 ${themeOptions.length} 套。完整主题库请使用 Welight 桌面端。`,
        ``,
      ].join(`\n`),
    )
    return 0
  }
}
