/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
import type { ServiceOption } from './types'

export const serviceOptions: ServiceOption[] = [
  {
    value: `deepseek`,
    label: `DeepSeek`,
    endpoint: `https://api.deepseek.com`,
    models: [`deepseek-v4-flash`, `deepseek-v4-pro`],
  },
  {
    value: `openai`,
    label: `OpenAI`,
    endpoint: `https://api.openai.com/v1`,
    models: [`gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`],
  },
  {
    value: `qwen`,
    label: `通义千问`,
    endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1`,
    models: [
      `qwen3.8-max`,
      `qwen3.7-plus`,
      `qwen3.8-flash`,
      `qwen3.7-flash`,
    ],
  },
  {
    value: `bigmodel`,
    label: `智谱 AI`,
    endpoint: `https://open.bigmodel.cn/api/paas/v4/`,
    models: [`glm-5.3`, `glm-5.3-flash`, `glm-5.2`, `glm-5.1`],
  },
  {
    value: `moonshot`,
    label: `Kimi`,
    endpoint: `https://api.moonshot.cn/v1`,
    models: [
      `kimi-k3`,
      `kimi-k2.7-code`,
      `kimi-k2.7-code-highspeed`,
      `kimi-k2.6`,
    ],
  },
  {
    value: `minimax`,
    label: `MiniMax`,
    endpoint: `https://api.minimaxi.com/v1`,
    models: [
      `MiniMax-M3`,
      `MiniMax-M2.7`,
      `MiniMax-M2.7-highspeed`,
      `MiniMax-M2.5`,
    ],
  },
  {
    value: `custom`,
    label: `Custom Provider`,
    endpoint: ``,
    models: [],
  },
]

export const DEFAULT_SERVICE_MODEL = serviceOptions[0].models[0]
