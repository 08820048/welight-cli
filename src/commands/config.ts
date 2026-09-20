import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig } from '../config'
import { c, ui } from '../ui'

export function registerConfig(program: Command): void {
  program
    .command(`config`)
    .description(`打印解析后的配置与来源文件`)
    .addHelpText(`after`, `\n展示 CLI 实际生效的配置；命令行参数与环境变量不在其中。`)
    .action(async () => {
      const { config, configFile } = await loadWelightConfig()
      process.stdout.write(`${c.bold(`配置文件：`)}${configFile ?? c.dim(`未创建（可运行 welight init）`)}\n\n`)
      process.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
      ui.dim(``)
    })
}
