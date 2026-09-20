import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, saveConfigValues } from '../config'
import { credentialsFilePath, saveCredential } from '../credentials'
import { askConfirm, askPassword, askText } from '../ink/prompts'
import { configureModel } from '../modelSetup'
import { providerLabel } from '../modelPresets'
import { isInteractive } from '../prompt'
import { c, printKeyValues, ui } from '../ui'

async function runWizard(): Promise<void> {
  if (!isInteractive()) {
    ui.error(`配置向导需要在交互式终端中运行。`)
    process.exitCode = 1
    return
  }

  ui.title(`Welight 配置向导`)
  process.stdout.write(`${c.dim(`第一步：配置模型（选提供商 → 选模型 → 填密钥，密钥不回显）。`)}\n`)
  const modelOk = await configureModel()
  if (!modelOk)
    ui.warn(`模型未配置完整，后面用到模型的功能会不可用。`)

  ui.title(`其他配置（可全部跳过）`)
  const typesafeKey = await askPassword(`TypeSafe 判断层 Key（可选）`)
  const zhuqueKey = await askPassword(`朱雀 EdgeOne Key（可选）`)
  const appId = await askText(`公众号 AppID（可选）`)
  const appSecret = await askPassword(`公众号 AppSecret（可选）`)
  const theme = await askText(`默认主题（可选，如 w011）`, `w001`)

  const planned: Array<[string, string]> = []
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

  if (planned.length > 0) {
    ui.title(`将保存以下配置`)
    printKeyValues(planned)
    const confirmed = await askConfirm(`确认保存？`)
    if (!confirmed) {
      ui.warn(`已取消，未保存其它配置。`)
    }
    else {
      if (theme)
        saveConfigValues({ theme })
      if (typesafeKey)
        saveCredential(`WELIGHT_TYPESAFE_KEY`, typesafeKey)
      if (zhuqueKey)
        saveCredential(`WELIGHT_ZHUQUE_KEY`, zhuqueKey)
      if (appId)
        saveCredential(`WELIGHT_WECHAT_APP_ID`, appId)
      if (appSecret)
        saveCredential(`WELIGHT_WECHAT_APP_SECRET`, appSecret)
    }
  }

  const { config, configFile } = await loadWelightConfig()
  ui.title(`配置完成`)
  printKeyValues([
    [`配置文件`, configFile ?? `未创建`],
    [`凭据文件`, credentialsFilePath()],
    [`模型`, config.model.model
      ? `${providerLabel(config.model.provider) || `自定义`} · ${config.model.model}`
      : `未配置`],
  ])
  process.stdout.write(`\n${c.dim(`下一步：welight doctor 自检，或 welight ai --chat 通过对话继续配置。`)}\n`)
}

export function registerSetup(program: Command): void {
  program
    .command(`setup`)
    .description(`配置向导：模型 + TypeSafe + 朱雀 + 公众号 + 主题（无需 AI）`)
    .addHelpText(`after`, `\n密钥本地安全输入，保存到本地凭据文件，不会上传。\n\n示例:\n  $ welight setup`)
    .action(async () => {
      await runWizard()
    })
}
