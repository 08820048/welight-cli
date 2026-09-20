/**
 * 内置规则库数据（离线基线，随 CLI 一起发布）。
 * 数据文件由 GUI 仓库导出，包含规则条目、分类、公告与判例。
 */

import type { WechatRulesPayload } from './engine/shared/types'
import type { WechatRulesData } from './engine/wechat/rules'
import rulesJson from './engine/rules/wechat-rules.json'

const payload = rulesJson as unknown as WechatRulesPayload

/** 扫描引擎所需的最小数据结构 */
export const RULES_DATA: WechatRulesData = {
  version: payload.version,
  categories: payload.categories,
  rules: payload.rules,
}

export const RULES_VERSION = payload.version
export const RULES_UPDATED_AT = payload.updatedAt
export const RULES_SOURCE_URL = payload.sourceUrl
