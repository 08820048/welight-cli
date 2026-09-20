/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 微信公众号平台规则知识库类型。
 *
 * 规则条目是对平台运营规范的摘要转述（含典型判例），不逐字复制官方原文；
 * 文本位置（span）相对各自被扫描的字符串（标题或正文）计算。
 */

export type WechatRuleSeverity = 'high' | 'medium' | 'low'

export type WechatRuleScope = 'title' | 'body'

export type WechatRulePatternKind = 'keyword' | 'regex'

/** 本地可确定性匹配的模式；语义类规则不配置 patterns，交给 AI 结合条文判断 */
export interface WechatRulePattern {
  kind: WechatRulePatternKind
  value: string
  /** 仅 regex 有效，默认 'gi' */
  flags?: string
  /** 命中提示，说明该模式的局限或需要复核的场景 */
  note?: string
}

export interface WechatRule {
  id: string
  category: string
  title: string
  description: string
  typicalCases: string[]
  severity: WechatRuleSeverity
  scope: WechatRuleScope[]
  patterns?: WechatRulePattern[]
  sourceUrl?: string
}

export interface WechatRuleCategoryInfo {
  id: string
  name: string
  description: string
}

export interface WechatRuleScanSpan {
  from: number
  to: number
  text: string
}

/** 判断层（TypeSafe System One）对单个命中的语义复核结论 */
export type WechatRuleJudgmentVerdict = 'confirmed' | 'downgraded' | 'uncertain' | 'unchecked'

export interface WechatRuleScanIssue {
  ruleId: string
  category: string
  ruleTitle: string
  severity: WechatRuleSeverity
  scope: WechatRuleScope
  span: WechatRuleScanSpan
  pattern: string
  patternNote?: string
  /** 语义复核结论；判断层不可用时缺省 */
  judgment?: {
    verdict: WechatRuleJudgmentVerdict
    /** 回答「构成风险」的概率（0-1） */
    probability?: number
    /** TypeSafe 报告的置信度（0-1） */
    confidence?: number
    /** 命中片段的上下文摘录，用于面板展示 */
    excerpt?: string
  }
}

export interface WechatRuleScanReport {
  scannedAt: string
  rulesVersion: string
  /** 本次扫描覆盖的、带本地模式的规则条数 */
  checkedRules: number
  issues: WechatRuleScanIssue[]
  matchedCategories: string[]
  /** 语义复核汇总；判断层不可用时缺省 */
  judgment?: {
    reviewed: number
    confirmed: number
    downgraded: number
    uncertain: number
    unchecked: number
    model?: string
  }
}

/** 规则中心「新规速递」公告条目 */
export interface WechatRuleAnnouncement {
  title: string
  date: string
  url: string
}

/** 规则中心「高频违规案例」文章条目 */
export interface WechatRuleCaseArticle {
  title: string
  url: string
}

/**
 * 规则知识库完整载荷：内置基线版与远程更新版共用同一结构，
 * 由规则中心《微信公众平台运营规范》与官方案例文章整理而来。
 */
export interface WechatRulesPayload {
  version: string
  updatedAt: string
  sourceUrl: string
  lawUrl: string
  categories: WechatRuleCategoryInfo[]
  rules: WechatRule[]
  announcements: WechatRuleAnnouncement[]
  caseArticles: WechatRuleCaseArticle[]
}
