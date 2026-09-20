/**
 * 模型配置向导：接口地址 / 模型名 / API Key 一次配齐。
 * 被 `welight model`、`welight setup`、`welight auth set model` 复用。
 *
 * 取值规则：
 * - 命令行传入的值优先；
 * - 交互终端下会提示（onlyMissing=true 时只补缺失项）；
 * - 非交互终端不提示，用已有配置补齐，仍缺失则报错并给出命令。
 */

import process from 'node:process'
import { loadWelightConfig, saveConfigValues } from './config'
import { saveCredential } from './credentials'
import { askPassword, askText } from './ink/prompts'
import { isInteractive } from './prompt'
import { ui } from './ui'

export interface ModelInput {
  baseUrl?: string
  model?: string
  apiKey?: string
}

export async function configureModel(input: ModelInput = {}, options: { onlyMissing?: boolean } = {}): Promise<boolean> {
  const { config } = await loadWelightConfig()
  const existingBaseUrl = config.model.baseUrl.trim()
  const existingModel = config.model.model.trim()
  const existingKey = (process.env.WELIGHT_MODEL_API_KEY ?? ``).trim()
  const interactive = isInteractive()

  let baseUrl = (input.baseUrl ?? ``).trim()
  let model = (input.model ?? ``).trim()
  let apiKey = (input.apiKey ?? ``).trim()

  const shouldPrompt = (provided: string, existing: string): boolean =>
    !provided && (options.onlyMissing ? !existing : interactive)

  if (shouldPrompt(baseUrl, existingBaseUrl))
    baseUrl = ((await askText(`模型接口地址（OpenAI 兼容）`, existingBaseUrl || `https://api.deepseek.com/v1`)) ?? ``).trim()
  if (shouldPrompt(model, existingModel))
    model = ((await askText(`模型名`, existingModel || `deepseek-chat`)) ?? ``).trim()
  if (shouldPrompt(apiKey, existingKey))
    apiKey = ((await askPassword(`模型 API Key`)) ?? ``).trim()

  const finalBaseUrl = baseUrl || existingBaseUrl
  const finalModel = model || existingModel
  const hasKey = Boolean(apiKey || existingKey)

  const missing: string[] = []
  if (!finalBaseUrl)
    missing.push(`模型接口(model.baseUrl)`)
  if (!finalModel)
    missing.push(`模型名(model.model)`)
  if (!hasKey)
    missing.push(`模型密钥`)

  if (missing.length > 0 && !interactive) {
    ui.error(
      `模型配置不完整，缺少：${missing.join(`、`)}。请执行：\n`
      + `  welight config set model.baseUrl <url>\n`
      + `  welight config set model.model <name>\n`
      + `  welight auth set model`,
    )
    return false
  }

  if (finalBaseUrl || finalModel)
    saveConfigValues({ model: { baseUrl: finalBaseUrl, model: finalModel } })
  if (apiKey)
    saveCredential(`WELIGHT_MODEL_API_KEY`, apiKey)

  if (missing.length > 0) {
    ui.warn(`模型配置仍缺少：${missing.join(`、`)}`)
    return false
  }

  ui.success(`模型配置完成：${finalModel} @ ${finalBaseUrl}`)
  return true
}
