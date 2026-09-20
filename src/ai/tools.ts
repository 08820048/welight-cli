/**
 * `welight ai` 可调用的 CLI 原生工具（不依赖 GUI）。
 *
 * 只提供只读/产物类能力；发布等有副作用的操作不放进模型工具循环，
 * 避免模型误触发。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { loadWelightConfig } from '../config'
import { scanWechatRules } from '../engine'
import type { ZhuqueDetectReport } from '../engine'
import { themeOptions } from '../engine'
import { RULES_DATA, RULES_VERSION } from '../rulesData'
import { scoreTitles } from '../titleScore'
import { resolveTypesafeEndpoint } from '../typesafe'
import { buildWeChatInlineHtml } from '../wechat'
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

/** 列出可用免费主题，便于模型推荐/选择 */
const listThemesTool: AiTool = {
  name: `list_themes`,
  description: `列出 CLI 可用的免费主题（名称与风格说明），用于给用户推荐主题。`,
  parameters: EMPTY_PARAMS,
  async run() {
    const lines = themeOptions.map(option => `${option.value}（${option.label}，${option.desc}）`)
    return `可用免费主题（${lines.length} 套）：${lines.join(`、`)}`
  },
}

/** 用指定主题渲染公众号内联 HTML 并保存为文件 */
const renderArticleTool: AiTool = {
  name: `render_article`,
  description: `用指定免费主题把当前文章渲染为公众号内联 HTML 并保存为文件，返回文件路径与大小。`,
  parameters: {
    type: `object`,
    properties: {
      theme: { type: `string`, description: `免费主题名，如 w001` },
      out: { type: `string`, description: `输出文件路径，缺省为当前目录 welight-preview.html` },
    },
    additionalProperties: false,
  },
  async run(args, doc) {
    if (!doc.content.trim())
      return `当前没有文章内容可渲染。`
    const theme = typeof args.theme === `string` && args.theme.trim() ? args.theme.trim() : undefined
    const out = typeof args.out === `string` && args.out.trim() ? args.out.trim() : `welight-preview.html`
    const target = path.isAbsolute(out) ? out : path.resolve(process.cwd(), out)

    const { config } = await loadWelightConfig()
    const html = buildWeChatInlineHtml(doc.content, {
      theme: theme ?? config.theme,
      primaryColor: config.primaryColor,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      customCSS: config.customCSS,
    })
    await fs.writeFile(target, html, `utf8`)
    return `已用主题 ${theme ?? config.theme} 渲染并保存：${target}（${Buffer.byteLength(html, `utf8`)} 字节）`
  },
}

/** 用 TypeSafe 判断层给候选标题评分（需 WELIGHT_TYPESAFE_KEY） */
const scoreTitlesTool: AiTool = {
  name: `score_titles`,
  description: `把候选标题交给 TypeSafe 判断层按「公众号打开潜力」1-5 级评分并排序。需要环境变量 WELIGHT_TYPESAFE_KEY。`,
  parameters: {
    type: `object`,
    properties: {
      titles: { type: `array`, items: { type: `string` }, description: `候选标题列表，最多 10 个` },
    },
    required: [`titles`],
    additionalProperties: false,
  },
  async run(args) {
    const key = (process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim()
    if (!key)
      return `未配置 WELIGHT_TYPESAFE_KEY，无法评分。`
    const titles = Array.isArray(args.titles) ? args.titles.filter((t): t is string => typeof t === `string`) : []
    if (titles.length === 0)
      return `未提供候选标题。`
    const report = await scoreTitles(titles, { apiKey: key, endpoint: resolveTypesafeEndpoint() })
    if (!report)
      return `判断层评分不可用。`
    const ranked = report.ranking.map((entry, index) => `${index + 1}. [${entry.score?.toFixed(2)}] ${entry.title}`)
    const unscored = report.unscored.length > 0 ? `\n（低置信未评分：${report.unscored.map(e => e.title).join(`；`)}）` : ``
    return `标题评分（模型 ${report.model ?? `未知`}）：\n${ranked.join(`\n`)}${unscored}`
  },
}

export const AI_TOOLS: AiTool[] = [
  checkRulesTool,
  detectAiTextTool,
  listThemesTool,
  renderArticleTool,
  scoreTitlesTool,
]
