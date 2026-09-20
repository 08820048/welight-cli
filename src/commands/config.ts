import { Command } from 'clipanion'
import { loadWelightConfig } from '../config'

export class ConfigCommand extends Command {
  static paths = [[`config`]]

  static usage = Command.Usage({
    description: `打印解析后的配置与来源文件`,
    details: `
      展示 CLI 实际生效的配置（命令行参数与环境变量不在其中）。
      配置文件为 welight.config.{json,ts,js,mjs,cjs}，可用 welight init 生成。
    `,
    examples: [[`查看配置`, `$0 config`]],
  })

  async execute(): Promise<number> {
    const { config, configFile } = await loadWelightConfig()
    this.context.stdout.write(`配置文件：${configFile ?? `未找到（使用默认值，可运行 welight init 生成）`}\n\n`)
    this.context.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
    return 0
  }
}
