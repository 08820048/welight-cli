import process from 'node:process'
import type { Command } from 'commander'
import { serviceOptions } from '../engine'
import { configureModel } from '../modelSetup'

export function registerModel(program: Command): void {
  const providerIds = serviceOptions.filter(option => option.value !== `custom`).map(option => option.value)
  program
    .command(`model`)
    .description(`配置模型（选提供商 → 选模型 → 填密钥）`)
    .option(`--provider <id>`, `提供商：${providerIds.join(` / `)}`)
    .option(`--base-url <url>`, `自定义接口地址（覆盖提供商默认值）`)
    .option(`--model <name>`, `模型名（覆盖默认模型）`)
    .option(`--api-key <key>`, `模型 API Key（建议省略，交互式遮罩输入）`)
    .addHelpText(`after`, `
示例:
  $ welight model                                   # 交互式选择提供商
  $ welight model --provider deepseek               # 用 DeepSeek 默认接口与模型
  $ welight model --provider openai --model gpt-5.6-sol`)
    .action(async (options: { provider?: string, baseUrl?: string, model?: string, apiKey?: string }) => {
      const ok = await configureModel({
        provider: options.provider,
        baseUrl: options.baseUrl,
        model: options.model,
        apiKey: options.apiKey,
      })
      if (!ok)
        process.exitCode = 1
    })
}
