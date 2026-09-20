import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, saveConfigValues } from '../config'
import { credentialsFilePath, saveCredential } from '../credentials'
import { askConfirm, askPassword, askText } from '../ink/prompts'
import { isInteractive } from '../prompt'
import { c, printKeyValues, ui } from '../ui'

async function runWizard(): Promise<void> {
  if (!isInteractive()) {
    ui.error(`配置向导需要在交互式终端中运行。`)
    process.exitCode = 1
    return
  }

  ui.title(`Welight 配置向导`)
  process.stdout.write(`${c.dim(`逐步输入即可，直接回车跳过该项。密钥不回显，保存到 ${credentialsFilePath()}。`)}\n`)

  const baseUrl = await askText(`模型接口地址（OpenAI 兼容）`, `https://api.deepseek.com/v1`)
  const model = await askText(`模型名`, `deepseek-chat`)
  const modelKey = await askPassword(`模型 API Key`)
  const typesafeKey = await askPassword(`TypeSafe 判断层 Key（可选）`)
  const zhuqueKey = await askPassword(`朱雀 EdgeOne Key（可选）`)
  const appId = await askText(`公众号 AppID（可选）`)
  const appSecret = await askPassword(`公众号 AppSecret（可选）`)
  const theme = await askText(`默认主题（可选，如 w011）`, `w001`)

  const modelPatch: Record<string, string> = {}
  if (baseUrl)
    modelPatch.baseUrl = baseUrl
  if (model)
    modelPatch.model = model

  const planned: Array<[string, string]> = []
  if (baseUrl)
    planned.push([`模型接口`, baseUrl])
  if (model)
    planned.push([`模型名`, model])
  if (modelKey)
    planned.push([`模型密钥`, `已输入（将保存）`])
  if (typesafeKey)
    planned.push([`TypeSafe Key`, `已输入（将保存）`])
  if (zhuqueKey)
    planned.push([`朱雀 Key`, `已输入（将保存）`])
  if (appId)
    planned.push([`公众号 AppID`, appId])
  if (appSecret)
    planned.push([`公众号 AppSecret`, `已输入（将保存）`])
  if (theme)
    planned.push([`默认主题`, theme])

  if (planned.length === 0) {
    ui.warn(`没有填写任何内容，未做修改。`)
    return
  }

  ui.title(`将保存以下配置`)
  printKeyValues(planned)

  const confirmed = await askConfirm(`确认保存？`)
  if (!confirmed) {
    ui.warn(`已取消，未做修改。`)
    return
  }

  if (Object.keys(modelPatch).length > 0 || theme)
    saveConfigValues({ ...(Object.keys(modelPatch).length > 0 ? { model: modelPatch } : {}), ...(theme ? { theme } : {}) })
  if (modelKey)
    saveCredential(`WELIGHT_MODEL_API_KEY`, modelKey)
  if (typesafeKey)
    saveCredential(`WELIGHT_TYPESAFE_KEY`, typesafeKey)
  if (zhuqueKey)
    saveCredential(`WELIGHT_ZHUQUE_KEY`, zhuqueKey)
  if (appId)
    saveCredential(`WELIGHT_WECHAT_APP_ID`, appId)
  if (appSecret)
    saveCredential(`WELIGHT_WECHAT_APP_SECRET`, appSecret)

  const { config, configFile } = await loadWelightConfig()
  ui.title(`配置完成`)
  printKeyValues([
    [`配置文件`, configFile ?? `未创建`],
    [`凭据文件`, credentialsFilePath()],
    [`模型`, config.model.model ? `${config.model.model} @ ${config.model.baseUrl || `默认接口`}` : `未配置`],
  ])
  process.stdout.write(`\n${c.dim(`下一步：welight doctor 自检，或 welight ai --chat 通过对话继续配置。`)}\n`)
}

export function registerSetup(program: Command): void {
  program
    .command(`setup`)
    .description(`配置向导：逐步完成模型 / 朱雀 / TypeSafe / 公众号等配置（无需 AI）`)
    .addHelpText(`after`, `\n密钥本地安全输入，保存到本地凭据文件，不会上传。\n\n示例:\n  $ welight setup`)
    .action(async () => {
      await runWizard()
    })
}
