/**
 * 朱雀 AIGC 检测直连客户端（BYOK，无官方代理）。
 *
 * CLI 只支持用户自配 EdgeOne API Key，直连腾讯 EdgeOne AI Gateway。
 */

import type { ZhuqueDetectReport, ZhuqueDetectResult } from './engine'
import { buildZhuqueReport, DETECT_MAX_CHARS, stripMarkdownForDetect, ZHUQUE_ENDPOINT } from './engine'

const DEFAULT_TIMEOUT_MS = 20_000

export interface DetectOptions {
  /** 用户自配的 EdgeOne API Key */
  apiKey: string
  timeoutMs?: number
  /** 覆盖上游地址（自建网关/测试用），默认官方 EdgeOne 网关 */
  endpoint?: string
}

interface ErrorPayload {
  message?: string
  detail?: string
  error?: string
}

async function requestZhuque(
  endpoint: string,
  payloadText: string,
  apiKey: string,
  timeoutMs: number,
): Promise<ZhuqueDetectResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: `POST`,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': `application/json`,
      },
      body: JSON.stringify({ text: payloadText, is_merge: false }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null) as
      | (ZhuqueDetectResult & Partial<ErrorPayload>)
      | null

    if (!response.ok) {
      if (response.status === 401)
        throw new Error(`EdgeOne API Key 无效或已过期`)
      if (response.status === 413)
        throw new Error(`文章过长，超出单次送检上限`)
      const message = data?.message || data?.detail || data?.error || `检测失败（HTTP ${response.status}）`
      throw new Error(message)
    }
    if (!data || data.status !== `success`)
      throw new Error(data?.msg || `检测服务返回异常`)

    return data as ZhuqueDetectResult
  }
  catch (error) {
    if (error instanceof Error && error.name === `AbortError`)
      throw new Error(`检测请求超时，请稍后重试`)
    throw error
  }
  finally {
    clearTimeout(timeout)
  }
}

/** 送检文本（自动剥离 Markdown、按上限截断），返回分段报告 */
export async function detectAiText(text: string, options: DetectOptions): Promise<ZhuqueDetectReport> {
  const cleaned = stripMarkdownForDetect(text)
  const truncated = cleaned.length > DETECT_MAX_CHARS
  const payloadText = cleaned.slice(0, DETECT_MAX_CHARS)
  if (!payloadText)
    throw new Error(`文章内容为空，无需检测`)

  const result = await requestZhuque(
    options.endpoint || ZHUQUE_ENDPOINT,
    payloadText,
    options.apiKey.trim(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  return buildZhuqueReport(result, payloadText.length, truncated)
}

/** AI 生成 + 疑似 AI 的合计占比（0-1） */
export function aiRatio(report: ZhuqueDetectReport): number {
  const ratio = report.result.labels_ratio ?? {}
  return (ratio[`1`] ?? 0) + (ratio[`2`] ?? 0)
}
