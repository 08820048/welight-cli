/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@7d56f98b
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 腾讯朱雀 AIGC 检测的纯逻辑部分（类型、Markdown 清洗、报告整理）。
 *
 * 网络请求与密钥管理由各端自行实现（GUI 走设置里的 Key / 官方代理，
 * CLI 走 BYOK 直连）。上游：EdgeOne AI Gateway。
 * 文档：https://cloud.tencent.com/document/product/1552/137539
 */

export const ZHUQUE_ENDPOINT = `https://ai-gateway.edgeone.link/v1/providers/zhuque-text/classify`

/** 单次检测的字符上限，防止单次消耗失控 */
export const DETECT_MAX_CHARS = 20_000

/** 标签含义：0 人工 / 1 AI 生成 / 2 疑似 AI */
export const ZHUQUE_LABEL_NAMES: Record<string, string> = {
  0: `人工`,
  1: `AI 生成`,
  2: `疑似 AI`,
}

export interface ZhuqueSegment {
  text: string
  /** 0 人工 / 1 AI / 2 疑似 AI */
  label: string
  conf: number
  order: number
  position: number
}

export interface ZhuqueDetectResult {
  status: string
  msg?: string
  /** 综合置信度：越高风险越高 */
  softmax_confidence: number
  /** 整体疑似风险比 */
  ratio_confidence: number
  /** 人工 / AI / 疑似 的占比 */
  labels_ratio: Record<string, number>
  segment_labels: ZhuqueSegment[]
  usage?: { total_tokens?: number }
}

export interface ZhuqueDetectReport {
  result: ZhuqueDetectResult
  /** 送检字符数（markdown 清洗后） */
  detectedChars: number
  /** 原文是否因超长被截断 */
  truncated: boolean
}

/** 轻量剥离 markdown 语法，减少标记符号对检测模型的干扰 */
export function stripMarkdownForDetect(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ` `)
    .replace(/`[^`\n]*`/g, ` `)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ` `)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, `$1`)
    .replace(/^#{1,6}\s+/gm, ``)
    .replace(/^>\s?/gm, ``)
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, `$1`)
    .replace(/^\s*[-*+]\s+/gm, ``)
    .replace(/^\s*\d+\.\s+/gm, ``)
    .replace(/\|/g, ` `)
    .replace(/^-{3,}\s*$/gm, ``)
    .replace(/\n{3,}/g, `\n\n`)
    .trim()
}

/** 纯函数：把网关响应整理为分段报告（按 position 排序，供单元测试与面板复用） */
export function buildZhuqueReport(result: ZhuqueDetectResult, detectedChars: number, truncated: boolean): ZhuqueDetectReport {
  const segments = [...(result.segment_labels ?? [])].sort((a, b) => a.position - b.position)
  return {
    result: { ...result, segment_labels: segments },
    detectedChars,
    truncated,
  }
}
