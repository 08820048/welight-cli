import process from 'node:process'
import type { Command } from 'commander'
import { configureModel } from '../modelSetup'

export function registerModel(program: Command): void {
  program
    .command(`model`)
    .description(`配置模型（接口地址 / 模型名 / API Key）`)
    .option(`--base-url <url>`, `OpenAI 兼容接口地址，如 https://api.deepseek.com/v1`)
    .option(`--model <name>`, `模型名，如 deepseek-chat`)
    .option(`--api-key <key>`, `模型 API Key（建议省略，交互式遮罩输入）`)
    .addHelpText(`after`, `\n示例:\n  $ welight model\n  $ welight model --base-url https://api.deepseek.com/v1 --model deepseek-chat`)
    .action(async (options: { baseUrl?: string, model?: string, apiKey?: string }) => {
      const ok = await configureModel({
        baseUrl: options.baseUrl,
        model: options.model,
        apiKey: options.apiKey,
      })
      if (!ok)
        process.exitCode = 1
    })
}
