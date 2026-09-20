/**
 * TypeSafe System One 判断层直连客户端（BYOK）。
 *
 * CLI 不走官方判断代理，直接用用户自配的 API Key 访问上游。
 * 任何网络/解析失败都返回 null，调用方需降级处理。
 */

import process from 'node:process'

const DEFAULT_ENDPOINT = `https://api.typesafe.ai/v1/systemone`

export interface TypeSafeAnswer {
  type?: string
  /** Noul：回答「是」的概率（0-1） */
  probability?: number
  /** 上游 Noul 原始字段 */
  noul?: number
  /** Choice：选中的选项键 */
  choice?: string
  /** Score：等级得分（可插值浮点） */
  score?: number
  legend?: Record<string, string>
  /** TypeSafe 报告的置信度（0-1） */
  confidence?: number
  probabilities?: Record<string, number>
}

export interface TypeSafeScoreQuestion {
  type: `score`
  instructions: string
  criteria: string[]
}

/** Choice：criteria 为「选项键 → 选项描述」，回答的 choice 即选项键 */
export interface TypeSafeChoiceQuestion {
  type: `choice`
  instructions: string
  criteria: Record<string, string>
}

/** Noul：回答「是」的概率（0-1） */
export interface TypeSafeNoulQuestion {
  type: `noul`
  instructions: string
}

export type TypeSafeQuestion = TypeSafeScoreQuestion | TypeSafeChoiceQuestion | TypeSafeNoulQuestion

export interface TypeSafeResponse {
  model?: string
  answers?: Record<string, TypeSafeAnswer>
}

export interface AskJudgmentOptions {
  apiKey: string
  endpoint?: string
  timeoutMs?: number
}

export function resolveTypesafeEndpoint(): string {
  return (process.env.WELIGHT_TYPESAFE_ENDPOINT ?? ``).trim() || DEFAULT_ENDPOINT
}

export async function askJudgment(
  state: string | Record<string, unknown>,
  questions: Record<string, TypeSafeQuestion>,
  options: AskJudgmentOptions,
): Promise<TypeSafeResponse | null> {
  const apiKey = options.apiKey.trim()
  if (!apiKey)
    return null

  const endpoint = (options.endpoint ?? ``).trim() || resolveTypesafeEndpoint()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000)
  try {
    const response = await fetch(endpoint, {
      method: `POST`,
      headers: {
        'content-type': `application/json`,
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ state, questions }),
      signal: controller.signal,
    })
    if (!response.ok)
      return null
    const data = await response.json() as TypeSafeResponse
    if (!data || typeof data !== `object` || !data.answers)
      return null
    return data
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timeout)
  }
}

export function answerScore(answer: TypeSafeAnswer | undefined): number | undefined {
  if (!answer)
    return undefined
  return typeof answer.score === `number` && !Number.isNaN(answer.score) ? answer.score : undefined
}

export function answerChoice(answer: TypeSafeAnswer | undefined): string | undefined {
  return typeof answer?.choice === `string` && answer.choice ? answer.choice : undefined
}

/** Noul：读取回答「是」的概率 */
export function answerProbability(answer: TypeSafeAnswer | undefined): number | undefined {
  if (!answer)
    return undefined
  if (typeof answer.probability === `number`)
    return answer.probability
  if (typeof answer.noul === `number`)
    return answer.noul
  return undefined
}
