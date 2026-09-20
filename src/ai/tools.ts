/**
 * `welight ai` 可调用的 CLI 原生工具（不依赖 GUI）。
 *
 * 只提供只读/产物类能力；发布等有副作用的操作不放进模型工具循环，
 * 避免模型误触发。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import readingTime from 'reading-time'
import { loadWelightConfig, missingModelConfig, resolveModelSettings, resolveTypesafeEndpoint, saveConfigValues } from '../config'
import { CREDENTIAL_SPECS, credentialStatus, isCredentialName, saveCredential } from '../credentials'
import { runCheckup } from '../checkup'
import { runLayout } from '../layout'
import { scanWechatRules } from '../engine'
import type { ZhuqueDetectReport } from '../engine'
import { themeOptions } from '../engine'
import { renderDocument } from '../render'
import { RULES_DATA, RULES_VERSION } from '../rulesData'
import { scoreTitles } from '../titleScore'
import { buildWeChatInlineHtml } from '../wechat'
import { aiRatio, detectAiText } from '../zhuqueApi'

export interface AgentContext {
  /** 当前文章正文（Markdown） */
  content: string
  /** 交互模式下的安全密钥输入回调（值不会进入模型上下文） */
  requestSecret?: (name: string, label: string) => Promise<string | null>
}

export interface AiTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  run: (args: Record<string, unknown>, ctx: AgentContext) => Promise<string>
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

/** 文章结构与篇幅统计 */
const articleStatsTool: AiTool = {
  name: `article_stats`,
  description: `统计当前文章的字数、预计阅读时间、各级标题、图片、链接与代码块数量，帮助判断篇幅与结构。`,
  parameters: EMPTY_PARAMS,
  async run(_args, doc) {
    const content = doc.content
    const chars = content.replace(/\s/g, ``).length
    const headings = [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(match => `${match[1].length} 级「${match[2].trim()}」`)
    const images = (content.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length
    const links = (content.match(/(?<!!)\[[^\]]*\]\([^)]*\)/g) ?? []).length
    const codeBlocks = Math.floor((content.match(/```/g) ?? []).length / 2)
    const minutes = Math.max(1, Math.round(readingTime(content).minutes))
    return `字数 ${chars}，预计阅读 ${minutes} 分钟；标题 ${headings.length} 个${headings.length ? `（${headings.slice(0, 12).join(`、`)}）` : ``}；图片 ${images}，链接 ${links}，代码块 ${codeBlocks}。`
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

/** 渲染独立 HTML 文档（浏览器预览） */
const renderDocumentTool: AiTool = {
  name: `render_document`,
  description: `用指定免费主题把当前文章渲染为独立 HTML 文件（可在浏览器打开预览），返回文件路径与大小。`,
  parameters: {
    type: `object`,
    properties: {
      theme: { type: `string`, description: `免费主题名，如 w001` },
      out: { type: `string`, description: `输出文件路径，缺省为当前目录 welight-document.html` },
    },
    additionalProperties: false,
  },
  async run(args, doc) {
    if (!doc.content.trim())
      return `当前没有文章内容可渲染。`
    const theme = typeof args.theme === `string` && args.theme.trim() ? args.theme.trim() : undefined
    const out = typeof args.out === `string` && args.out.trim() ? args.out.trim() : `welight-document.html`
    const target = path.isAbsolute(out) ? out : path.resolve(process.cwd(), out)
    const { config } = await loadWelightConfig()
    const html = renderDocument(doc.content, {
      theme: theme ?? config.theme,
      primaryColor: config.primaryColor,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      customCSS: config.customCSS,
    })
    await fs.writeFile(target, html, `utf8`)
    return `已用主题 ${theme ?? config.theme} 渲染独立 HTML：${target}（${Buffer.byteLength(html, `utf8`)} 字节）`
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
    const { config } = await loadWelightConfig()
    const report = await scoreTitles(titles, { apiKey: key, endpoint: resolveTypesafeEndpoint(config) })
    if (!report)
      return `判断层评分不可用。`
    const ranked = report.ranking.map((entry, index) => `${index + 1}. [${entry.score?.toFixed(2)}] ${entry.title}`)
    const unscored = report.unscored.length > 0 ? `\n（低置信未评分：${report.unscored.map(e => e.title).join(`；`)}）` : ``
    return `标题评分（模型 ${report.model ?? `未知`}）：\n${ranked.join(`\n`)}${unscored}`
  },
}

/** 一键排版当前文章 */
const layoutArticleTool: AiTool = {
  name: `layout_article`,
  description: `对当前文章执行一键排版，按档位（auto/minimal/standard/rich）重排标题层级、强调与列表，保留事实与代码。`,
  parameters: {
    type: `object`,
    properties: {
      tier: { type: `string`, enum: [`auto`, `minimal`, `standard`, `rich`], description: `排版档位，默认 minimal` },
    },
    additionalProperties: false,
  },
  async run(args, ctx) {
    if (!ctx.content.trim())
      return `当前没有文章内容可排版。`
    const { config } = await loadWelightConfig()
    const missing = missingModelConfig(config)
    if (missing.length > 0)
      return `模型配置不完整，缺少：${missing.join(`、`)}。请让用户先运行 welight model。`
    const settings = resolveModelSettings(config, {})
    const requested = typeof args.tier === `string` ? args.tier : `minimal`
    const tier = ([`auto`, `minimal`, `standard`, `rich`].includes(requested) ? requested : `minimal`) as `auto` | `minimal` | `standard` | `rich`
    try {
      const result = await runLayout(ctx.content, {
        tier,
        model: settings,
        typesafe: { apiKey: (process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim(), endpoint: resolveTypesafeEndpoint(config) },
      })
      return `已排版（档位 ${result.tier}）：\n\n${result.markdown}`
    }
    catch (error) {
      return `排版失败：${error instanceof Error ? error.message : String(error)}`
    }
  },
}

/** 文章体检（12 项） */
const articleCheckupTool: AiTool = {
  name: `article_checkup`,
  description: `对当前文章做 12 项体检（开头/结构/过渡/长段落/重复/术语/表格图表机会/可读性/收尾/互动/标题一致性）。需要 WELIGHT_TYPESAFE_KEY。`,
  parameters: EMPTY_PARAMS,
  async run(_args, ctx) {
    if (!ctx.content.trim())
      return `当前没有文章内容可体检。`
    const key = (process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim()
    if (!key)
      return `未配置 WELIGHT_TYPESAFE_KEY，无法体检。`
    const { config } = await loadWelightConfig()
    try {
      const report = await runCheckup(ctx.content, { apiKey: key, endpoint: resolveTypesafeEndpoint(config) })
      const issues = report.items.filter(item => item.status === `action` || item.status === `watch`)
      const lines = issues.map(item => `- [${item.status === `action` ? `建议处理` : `关注`}] ${item.label}：${item.suggestion}`)
      return `体检完成：良好 ${report.counts.pass} / 关注 ${report.counts.watch} / 建议处理 ${report.counts.action} / 未判定 ${report.counts.unknown}\n${lines.join(`\n`)}`
    }
    catch (error) {
      return `体检失败：${error instanceof Error ? error.message : String(error)}`
    }
  },
}

/** 查询当前配置与凭据状态（不含密钥值） */
const getConfigStatusTool: AiTool = {
  name: `get_config_status`,
  description: `查看当前 CLI 配置（主题、代码高亮、水印、模型接口、lint 阈值）与各凭据是否已配置。配置前先调用它了解现状。`,
  parameters: EMPTY_PARAMS,
  async run() {
    const { config, configFile } = await loadWelightConfig()
    const creds = credentialStatus().map(item => `${item.label}：${item.configured ? `已配置` : `未配置`}`)
    return [
      `配置文件：${configFile ?? `未创建`}`,
      `主题 ${config.theme}；代码高亮 ${config.codeTheme}；水印 ${config.watermark ? `开` : `关`}；lint 阈值 ${config.lint.failOn}`,
      `模型接口 ${config.model.baseUrl || `未配置`}；模型名 ${config.model.model || `未配置`}`,
      `凭据：${creds.join(`；`)}`,
    ].join(`\n`)
  },
}

/** 写入非敏感配置 */
const saveConfigTool: AiTool = {
  name: `save_config`,
  description: `把非敏感配置写入 welight.config.json：主题、代码高亮、水印、微信代理、模型接口/模型名、lint 阈值。密钥请改用 store_secret。`,
  parameters: {
    type: `object`,
    properties: {
      theme: { type: `string`, description: `免费主题名，如 w001` },
      codeTheme: { type: `string`, description: `highlight.js 代码高亮主题，none 关闭` },
      watermark: { type: `boolean`, description: `发布是否追加文末水印` },
      proxy: { type: `string`, description: `自建微信 API 反向代理 origin，留空直连` },
      modelBaseUrl: { type: `string`, description: `OpenAI 兼容接口地址` },
      modelModel: { type: `string`, description: `模型名` },
      lintFailOn: { type: `string`, enum: [`none`, `low`, `medium`, `high`], description: `lint 失败阈值` },
    },
    additionalProperties: false,
  },
  async run(args) {
    const patch: Record<string, unknown> = {}
    if (typeof args.theme === `string`)
      patch.theme = args.theme
    if (typeof args.codeTheme === `string`)
      patch.codeTheme = args.codeTheme
    if (typeof args.watermark === `boolean`)
      patch.watermark = args.watermark
    if (typeof args.proxy === `string`)
      patch.proxy = args.proxy
    if (typeof args.lintFailOn === `string`)
      patch.lint = { failOn: args.lintFailOn }
    const modelPatch: Record<string, string> = {}
    if (typeof args.modelBaseUrl === `string`)
      modelPatch.baseUrl = args.modelBaseUrl
    if (typeof args.modelModel === `string`)
      modelPatch.model = args.modelModel
    if (Object.keys(modelPatch).length > 0)
      patch.model = modelPatch
    if (Object.keys(patch).length === 0)
      return `没有需要保存的配置项。`
    const { file, config } = saveConfigValues(patch)
    return `已写入配置：${file}（主题 ${config.theme}，模型 ${config.model.model || `未设置`}）`
  },
}

/** 安全收集密钥（用户本地输入，值不发给模型） */
const storeSecretTool: AiTool = {
  name: `store_secret`,
  description: `在用户本地安全收集一个凭据并保存到本地凭据文件，值不会发送给模型。当用户要配置模型 Key / TypeSafe / 朱雀 / 公众号凭据时调用。`,
  parameters: {
    type: `object`,
    properties: {
      name: { type: `string`, enum: Object.keys(CREDENTIAL_SPECS), description: `凭据项` },
    },
    required: [`name`],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const name = typeof args.name === `string` ? args.name : ``
    if (!isCredentialName(name))
      return `不支持的凭据项：${name}`
    const label = CREDENTIAL_SPECS[name]
    if (!ctx.requestSecret)
      return `当前不是交互模式，无法安全输入「${label}」。请让用户在终端运行 welight ai --chat，或手动设置环境变量 ${name}。`
    const value = await ctx.requestSecret(name, label)
    if (!value)
      return `用户取消了「${label}」的输入。`
    saveCredential(name, value)
    return `已保存「${label}」到本地凭据文件（值未发送给模型）。`
  },
}

export const AI_TOOLS: AiTool[] = [
  checkRulesTool,
  detectAiTextTool,
  listThemesTool,
  articleStatsTool,
  renderArticleTool,
  renderDocumentTool,
  scoreTitlesTool,
  layoutArticleTool,
  articleCheckupTool,
  getConfigStatusTool,
  saveConfigTool,
  storeSecretTool,
]
