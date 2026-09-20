/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@61d1500d
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 微信公众号平台规则引擎（纯逻辑，零重依赖）。
 *
 * 提供规则分类/条目检索与本地确定性扫描（关键词 + 正则），所有函数
 * 接收 `WechatRulesData` 结构参数（内置基线版与远程更新版同构），
 * 本模块不关心数据来源与加载时机。
 * pattern 匹配只产出“命中线索”，不等于违规结论；语义类规则由 AI 结合
 * 规则条文与判例另行判断。
 */

import type {
  WechatRule,
  WechatRuleCategoryInfo,
  WechatRulePattern,
  WechatRuleScanIssue,
  WechatRuleScanReport,
  WechatRuleScanSpan,
} from '../shared/types'

const DEFAULT_QUERY_LIMIT = 10
const MAX_QUERY_LIMIT = 30
const MAX_MATCHES_PER_PATTERN = 20
const MAX_TOTAL_ISSUES = 200

/** 扫描与语义复核共用的正文截断长度，保证 span 坐标一致 */
export const MAX_SCAN_TEXT_LENGTH = 200_000

export interface WechatRulesData {
  /** 规则库版本号，形如 2026.09.1 */
  version: string
  categories: WechatRuleCategoryInfo[]
  rules: WechatRule[]
}

export interface WechatRuleQueryOptions {
  category?: string
  keyword?: string
  limit?: number
}

export interface WechatRuleQueryResult {
  total: number
  returned: number
  rules: WechatRule[]
}

interface ScanScope {
  scope: 'title' | 'body'
  text: string
}

const regexCache = new Map<string, RegExp | null>()

function compileRegex(pattern: WechatRulePattern, ruleId: string): RegExp | null {
  const cacheKey = `${ruleId}::${pattern.value}::${pattern.flags ?? ''}`
  const cached = regexCache.get(cacheKey)
  if (cached !== undefined)
    return cached
  let compiled: RegExp | null = null
  try {
    const flags = pattern.flags ?? 'gi'
    compiled = new RegExp(pattern.value, flags.includes('g') ? flags : `${flags}g`)
  }
  catch {
    compiled = null
  }
  regexCache.set(cacheKey, compiled)
  return compiled
}

function keywordSpans(text: string, value: string): WechatRuleScanSpan[] {
  const haystack = text.toLowerCase()
  const needle = value.toLowerCase()
  if (!needle)
    return []
  const spans: WechatRuleScanSpan[] = []
  let index = haystack.indexOf(needle)
  while (index !== -1 && spans.length < MAX_MATCHES_PER_PATTERN) {
    spans.push({
      from: index,
      to: index + needle.length,
      text: text.slice(index, index + needle.length),
    })
    index = haystack.indexOf(needle, index + needle.length)
  }
  return spans
}

function regexSpans(text: string, regex: RegExp): WechatRuleScanSpan[] {
  const spans: WechatRuleScanSpan[] = []
  regex.lastIndex = 0
  let match = regex.exec(text)
  while (match && spans.length < MAX_MATCHES_PER_PATTERN) {
    if (match[0].length > 0) {
      spans.push({ from: match.index, to: match.index + match[0].length, text: match[0] })
    }
    else {
      regex.lastIndex += 1
    }
    match = regex.exec(text)
  }
  return spans
}

export function wechatRuleCategoryIds(data: WechatRulesData): string[] {
  return data.categories.map(category => category.id)
}

export function listWechatRuleCategories(
  data: WechatRulesData,
): Array<WechatRuleCategoryInfo & { ruleCount: number }> {
  return data.categories.map(category => ({
    ...category,
    ruleCount: data.rules.filter(rule => rule.category === category.id).length,
  }))
}

export function queryWechatRules(
  options: WechatRuleQueryOptions,
  data: WechatRulesData,
): WechatRuleQueryResult {
  const category = options.category?.trim()
  const keyword = options.keyword?.trim().toLowerCase()
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_QUERY_LIMIT, 1), MAX_QUERY_LIMIT)
  const filtered = data.rules.filter((rule) => {
    if (category && rule.category !== category)
      return false
    if (!keyword)
      return true
    return [rule.id, rule.title, rule.description, ...rule.typicalCases]
      .join('\n')
      .toLowerCase()
      .includes(keyword)
  })
  return {
    total: filtered.length,
    returned: Math.min(filtered.length, limit),
    rules: filtered.slice(0, limit),
  }
}

export function scanWechatRules(
  input: { title?: string, content?: string },
  data: WechatRulesData,
): WechatRuleScanReport {
  const scopes: ScanScope[] = []
  const title = input.title?.trim()
  const content = input.content?.slice(0, MAX_SCAN_TEXT_LENGTH) ?? ''
  if (title)
    scopes.push({ scope: 'title', text: title })
  if (content)
    scopes.push({ scope: 'body', text: content })

  const issues: WechatRuleScanIssue[] = []
  let checkedRules = 0

  for (const rule of data.rules) {
    if (issues.length >= MAX_TOTAL_ISSUES)
      break
    if (!rule.patterns?.length)
      continue
    checkedRules += 1
    for (const pattern of rule.patterns) {
      if (issues.length >= MAX_TOTAL_ISSUES)
        break
      for (const scope of scopes) {
        if (!rule.scope.includes(scope.scope))
          continue
        const compiled = pattern.kind === 'regex' ? compileRegex(pattern, rule.id) : null
        if (pattern.kind === 'regex' && !compiled)
          continue
        const spans = pattern.kind === 'keyword'
          ? keywordSpans(scope.text, pattern.value)
          : regexSpans(scope.text, compiled as RegExp)
        for (const span of spans) {
          issues.push({
            ruleId: rule.id,
            category: rule.category,
            ruleTitle: rule.title,
            severity: rule.severity,
            scope: scope.scope,
            span,
            pattern: pattern.value,
            patternNote: pattern.note,
          })
          if (issues.length >= MAX_TOTAL_ISSUES)
            break
        }
        if (issues.length >= MAX_TOTAL_ISSUES)
          break
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    rulesVersion: data.version,
    checkedRules,
    issues,
    matchedCategories: [...new Set(issues.map(issue => issue.category))],
  }
}
