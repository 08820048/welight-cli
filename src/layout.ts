/**
 * 一键排版：按档位用模型重排文章结构（与 GUI 的 convertSmart 一致）。
 * 提示词来自 GUI 的 visualPromptConfig（已同步到 src/engine）。
 */

import type { LayoutPromptTier, LayoutTierSetting } from './engine'
import { VisualPromptConfigManager } from './engine'
import { chatCompletion } from './modelClient'
import { answerChoice, askJudgment } from './typesafe'

// GUI 的 VisualPromptConfigManager 依赖浏览器 localStorage；Node 下提供空实现，避免告警
// 注意：不要读取 globalThis.localStorage（Node 的 getter 会打印实验性告警），直接 defineProperty 覆盖
try {
  Object.defineProperty(globalThis, `localStorage`, {
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    configurable: true,
    writable: true,
  })
}
catch {
  // 无法覆盖时忽略
}

const manager = new VisualPromptConfigManager()

export const TIER_LABELS: Record<LayoutPromptTier, string> = {
  minimal: `简约`,
  standard: `标准`,
  rich: `丰富`,
}

export const TIER_DESCRIPTIONS: Record<LayoutTierSetting, string> = {
  auto: `AI 按文章内容推荐档位`,
  minimal: `克制、干净、结构分明`,
  standard: `兼顾结构与可读性`,
  rich: `视觉层次更丰富`,
}

const AUTO_TIER_CRITERIA: Record<string, string> = {
  minimal: `克制干净、结构分明，原文表述几乎不被改写，适合极简资讯或大多数普通文章`,
  standard: `兼顾结构与可读性，适度使用标题层级与重点强调，适合教程与说明文`,
  rich: `视觉层次更丰富，标题、引用、表格、强调等手法充分运用，适合技术评测或需要强表现力的文章`,
}

const AUTO_TIER_STATE_MAX_CHARS = 8000
const AUTO_TIER_MIN_CONFIDENCE = 0.6

export interface LayoutModelSettings {
  baseUrl: string
  apiKey: string
  model: string
}

export interface LayoutTypesafeSettings {
  apiKey: string
  endpoint?: string
}

/** 解析本次排版实际使用的档位（auto 时由判断层推荐，不可用回退 minimal） */
export async function resolveLayoutTier(
  text: string,
  setting: LayoutTierSetting,
  typesafe: LayoutTypesafeSettings,
): Promise<{ tier: LayoutPromptTier, recommended: boolean }> {
  if (setting !== `auto`)
    return { tier: setting, recommended: false }
  if (!typesafe.apiKey.trim())
    return { tier: `minimal`, recommended: false }

  const state = text.slice(0, AUTO_TIER_STATE_MAX_CHARS)
  if (!state.trim())
    return { tier: `minimal`, recommended: false }

  const response = await askJudgment(state, {
    tier: {
      type: `choice`,
      instructions: `根据文章内容与写法，选择最适合它在微信公众号中呈现的排版强度档位。`,
      criteria: AUTO_TIER_CRITERIA,
    },
  }, { apiKey: typesafe.apiKey, endpoint: typesafe.endpoint })

  const answer = response?.answers?.tier
  const choice = answerChoice(answer)
  const confidence = typeof answer?.confidence === `number` ? answer.confidence : 0
  const tier = choice && choice in AUTO_TIER_CRITERIA && confidence >= AUTO_TIER_MIN_CONFIDENCE
    ? choice as LayoutPromptTier
    : `minimal`
  return { tier, recommended: true }
}

export interface LayoutResult {
  tier: LayoutPromptTier
  recommended: boolean
  markdown: string
}

/** 生成指定档位的一键排版提示词 */
export function buildLayoutPrompt(tier: LayoutPromptTier): string {
  return manager.generatePrompt(tier)
}

export async function runLayout(
  text: string,
  options: {
    tier: LayoutTierSetting
    model: LayoutModelSettings
    typesafe: LayoutTypesafeSettings
    timeoutMs?: number
  },
): Promise<LayoutResult> {
  const { tier, recommended } = await resolveLayoutTier(text, options.tier, options.typesafe)
  const prompt = `${buildLayoutPrompt(tier)}\n\n${text}`
  const markdown = await chatCompletion({
    baseUrl: options.model.baseUrl,
    apiKey: options.model.apiKey,
    model: options.model.model,
    messages: [{ role: `user`, content: prompt }],
    temperature: 0.3,
    timeoutMs: options.timeoutMs ?? 120_000,
  })
  return { tier, recommended, markdown: markdown.trim() }
}
