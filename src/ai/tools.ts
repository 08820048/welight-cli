/**
 * `welight ai` 可调用的 CLI 原生工具（不依赖 GUI）。
 */

import process from 'node:process'
import { scanWechatRules } from '../engine'
import { RULES_DATA, RULES_VERSION } from '../rulesData'
import type { ZhuqueDetectReport } from '../engine'
import { aiRatio, detectAiText } from '../zhuqueApi'

export interface AgentDocument {
  /** 当前文章正文（Markdown） */
  content: string
}

export interface AiTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  run: (args: Record<string, unknown>, doc: AgentDocument) => Promise<string>
}

function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 1000) / 10}%`
}

const EMPTY_PARAMS = { type: `object`, properties: {}, additionalProperties: false }

/** 公众号规则本地扫描 */
const checkRulesTool: AiTool = {
  name: `check_wechat_rules`,
  description: `对当前文章做微信公众号平台规则本地扫描，返回命中线索（关键词/正则）。命中是风险线索而非违规结论。`,
  parameters: EMPTY_PARAMS,
  async run(_args, doc) {
    const report = scanWechatRules({ content: doc.content }, RULES_DATA)
    if (report.issues.length === 0)
      return `规则库 ${RULES_VERSION}：未发现命中项。`
    const lines = report.issues.slice(0, 30).map(issue =>
      `- [${issue.severity}] ${issue.ruleTitle}（${issue.scope}）：命中「${issue.span.text.replace(/\s+/g, ` `)}」${issue.patternNote ? ` / ${issue.patternNote}` : ``}`,
    )
    return `规则库 ${RULES_VERSION}，命中 ${report.issues.length} 处：\n${lines.join(`\n`)}`
  },
}

/** 朱雀 AIGC 检测（需自配 EdgeOne Key） */
const detectAiTextTool: AiTool = {
  name: `detect_ai_text`,
  description: `调用腾讯朱雀 AIGC 检测当前文章的 AI 生成占比。需要环境变量 WELIGHT_ZHUQUE_KEY。`,
  parameters: EMPTY_PARAMS,
  async run(_args, doc) {
    const key = (process.env.WELIGHT_ZHUQUE_KEY ?? ``).trim()
    if (!key)
      return `未配置 WELIGHT_ZHUQUE_KEY，无法执行朱雀检测。`
    const report: ZhuqueDetectReport = await detectAiText(doc.content, {
      apiKey: key,
      endpoint: process.env.WELIGHT_ZHUQUE_ENDPOINT,
    })
    const labels = report.result.labels_ratio ?? {}
    return `朱雀检测：人工 ${percent(labels[`0`])} / AI 生成 ${percent(labels[`1`])} / 疑似 AI ${percent(labels[`2`])}，AI + 疑似合计 ${percent(aiRatio(report))}。`
  },
}

export const AI_TOOLS: AiTool[] = [checkRulesTool, detectAiTextTool]
