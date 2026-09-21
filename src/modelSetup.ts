/**
 * 模型配置：内置提供商预设，用户只需「选提供商 → 选模型 → 填密钥」。
 *
 * 提供商与模型清单来自 GUI 的 serviceOptions（导出到 src/engine）。
 * 被 `welight model`、`welight setup`、`welight auth set model` 复用。
 *
 * 取值规则：
 * - 命令行传入的值优先；
 * - 交互终端用选择列表引导（onlyMissing=true 时只补缺失项）；
 * - 非交互终端不提示，用预设/已有值补齐，仍缺失则报错并给出命令。
 */

import process from 'node:process'
import { loadWelightConfig, saveConfigValues } from './config'
import { saveCredential } from './credentials'
import { askAutocomplete, askPassword, askText } from './prompt'
import { findServiceOption, providerLabel, serviceOptions } from './modelPresets'
import { isInteractive } from './prompt'
import { c, ui } from './ui'

export interface ModelInput {
  provider?: string
  baseUrl?: string
  model?: string
  apiKey?: string
}

export async function configureModel(input: ModelInput = {}, options: { onlyMissing?: boolean } = {}): Promise<boolean> {
  const { config } = await loadWelightConfig()
  const interactive = isInteractive()
  const onlyMissing = Boolean(options.onlyMissing)

  const existingProvider = config.model.provider.trim()
  const existingBaseUrl = config.model.baseUrl.trim()
  const existingModel = config.model.model.trim()
  const existingKey = (process.env.WELIGHT_MODEL_API_KEY ?? ``).trim()

  let provider = (input.provider ?? existingProvider).trim()
  let baseUrl = (input.baseUrl ?? ``).trim()
  let model = (input.model ?? ``).trim()
  let apiKey = (input.apiKey ?? ``).trim()

  // 是否需要让用户选提供商
  const needPickProvider = interactive
    && !input.provider
    && (!onlyMissing ? true : (!existingProvider && !existingBaseUrl))

  if (needPickProvider) {
    const picked = await askAutocomplete(
      `选择模型提供商（可输入关键词过滤）`,
      serviceOptions.map(option => ({
        value: option.value,
        label: option.label,
        hint: option.value === `custom` ? `自定义接口` : option.endpoint,
      })),
    )
    provider = picked ?? provider
  }

  const preset = findServiceOption(provider)

  if (preset && preset.value !== `custom`) {
    if (!baseUrl)
      baseUrl = preset.endpoint
    if (!model) {
      if (interactive && (!onlyMissing || !existingModel)) {
        const modelOptions = preset.models.map(name => ({ label: name, value: name }))
        modelOptions.push({ label: `自定义模型名…`, value: `__custom__` })
        const picked = await askAutocomplete(`选择模型（可输入关键词过滤）`, modelOptions)
        model = picked === `__custom__` ? ((await askText(`模型名`)) ?? ``).trim() : (picked ?? ``)
      }      else {
        model = existingModel || preset.models[0] || ``
      }
    }
  }
  else {
    if (interactive && !baseUrl && (!onlyMissing || !existingBaseUrl))
      baseUrl = ((await askText(`模型接口地址（OpenAI 兼容）`, existingBaseUrl || `https://api.openai.com/v1`)) ?? ``).trim()
    if (!baseUrl)
      baseUrl = existingBaseUrl
    if (interactive && !model && (!onlyMissing || !existingModel))
      model = ((await askText(`模型名`, existingModel || ``)) ?? ``).trim()
    if (!model)
      model = existingModel
  }

  if (interactive && !apiKey && (!onlyMissing || !existingKey))
    apiKey = ((await askPassword(`模型 API Key`)) ?? ``).trim()

  const finalProvider = provider || existingProvider
  const finalBaseUrl = baseUrl || existingBaseUrl
  const finalModel = model || existingModel
  const hasKey = Boolean(apiKey || existingKey)

  const missing: string[] = []
  if (!finalBaseUrl)
    missing.push(`模型接口地址`)
  if (!finalModel)
    missing.push(`模型名`)
  if (!hasKey)
    missing.push(`模型密钥`)

  if (missing.length > 0 && !interactive) {
    ui.error(
      `模型配置不完整，缺少：${missing.join(`、`)}。请执行：\n`
      + `  welight model --provider <deepseek|openai|qwen|bigmodel|moonshot|minimax>\n`
      + `  welight auth set model`,
    )
    return false
  }

  saveConfigValues({ model: { provider: finalProvider, baseUrl: finalBaseUrl, model: finalModel } })
  if (apiKey)
    saveCredential(`WELIGHT_MODEL_API_KEY`, apiKey)

  if (missing.length > 0) {
    ui.warn(`模型配置仍缺少：${missing.join(`、`)}`)
    return false
  }

  ui.success(`模型配置完成：${providerLabel(finalProvider) || `自定义`} · ${finalModel}`)
  return true
}
