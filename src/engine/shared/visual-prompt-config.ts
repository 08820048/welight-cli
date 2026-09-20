/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
import type { LayoutPromptTier } from './layout-tier'
import { DEFAULT_LAYOUT_PROMPT_TIER, LAYOUT_PROMPT_TIERS } from './layout-tier'

export type Frequency = 'low' | 'medium' | 'high'

export interface BasicConfig {
  preserveOriginalMeaning: boolean
  optimizeExpression: boolean
}

export interface HeadingsConfig {
  enabled: boolean
  frequency: Frequency
  maxLevel: number
  useEmoji: boolean
}

export interface EmphasisConfig {
  useBold: boolean
  useItalic: boolean
  useBoldItalic: boolean
  useStrikethrough: boolean
  frequency: Frequency
}

export interface InlineCodeConfig {
  forTerms: boolean
  forEnglish: boolean
  forNumbers: boolean
  forFilenames: boolean
}

export interface ListsConfig {
  useUnordered: boolean
  useOrdered: boolean
  maxNesting: number
  useEmojiMarkers: boolean
}

export interface BlockquotesConfig {
  enabled: boolean
  useEmoji: boolean
  frequency: Frequency
}

export interface OtherConfig {
  useTables: boolean
  useHorizontalRules: boolean
  useCodeBlocks: boolean
}

/**
 * GFM Alert 提示框配置
 * 支持的类型：note（笔记）、tip（提示）、important（重要）、warning（警告）、caution（注意）
 */
export interface AlertConfig {
  enabled: boolean
  useNote: boolean
  useTip: boolean
  useImportant: boolean
  useWarning: boolean
  useCaution: boolean
  frequency: Frequency
}

export interface VisualPromptConfig {
  basic: BasicConfig
  headings: HeadingsConfig
  emphasis: EmphasisConfig
  inlineCode: InlineCodeConfig
  lists: ListsConfig
  blockquotes: BlockquotesConfig
  alerts: AlertConfig
  other: OtherConfig
}

/**
 * “简约”档（默认）：干净利落、结构分明、主次清晰
 * - 标题最多两级，谨慎使用；强调只保留粗体；引用块极少出现
 * - 关闭 GFM 提示框与分隔线，这两者是最容易造成“花哨感”的语法
 */
export const MINIMAL_TIER_DEFAULTS: VisualPromptConfig = {
  basic: { preserveOriginalMeaning: true, optimizeExpression: true },
  headings: { enabled: true, frequency: 'low', maxLevel: 2, useEmoji: false },
  emphasis: { useBold: true, useItalic: false, useBoldItalic: false, useStrikethrough: false, frequency: 'low' },
  inlineCode: { forTerms: false, forEnglish: false, forNumbers: false, forFilenames: true },
  lists: { useUnordered: true, useOrdered: true, maxNesting: 1, useEmojiMarkers: false },
  blockquotes: { enabled: true, useEmoji: false, frequency: 'low' },
  alerts: { enabled: false, useNote: false, useTip: false, useImportant: false, useWarning: false, useCaution: false, frequency: 'low' },
  other: { useTables: true, useHorizontalRules: false, useCodeBlocks: true },
}

/**
 * “标准”档：兼顾结构与可读性，比简约档多一层标题、允许适度强调和常用提示框
 */
export const STANDARD_TIER_DEFAULTS: VisualPromptConfig = {
  basic: { preserveOriginalMeaning: true, optimizeExpression: true },
  headings: { enabled: true, frequency: 'medium', maxLevel: 3, useEmoji: false },
  emphasis: { useBold: true, useItalic: false, useBoldItalic: false, useStrikethrough: false, frequency: 'medium' },
  inlineCode: { forTerms: true, forEnglish: true, forNumbers: false, forFilenames: true },
  lists: { useUnordered: true, useOrdered: true, maxNesting: 2, useEmojiMarkers: false },
  blockquotes: { enabled: true, useEmoji: false, frequency: 'low' },
  alerts: { enabled: true, useNote: true, useTip: true, useImportant: true, useWarning: false, useCaution: false, frequency: 'low' },
  other: { useTables: true, useHorizontalRules: false, useCodeBlocks: true },
}

/**
 * “丰富”档：视觉层次更丰富，对应旧版“智能排版”的默认效果，供偏好原风格的用户选择
 */
export const RICH_TIER_DEFAULTS: VisualPromptConfig = {
  basic: { preserveOriginalMeaning: true, optimizeExpression: true },
  headings: { enabled: true, frequency: 'medium', maxLevel: 3, useEmoji: false },
  emphasis: { useBold: true, useItalic: true, useBoldItalic: false, useStrikethrough: false, frequency: 'medium' },
  inlineCode: { forTerms: true, forEnglish: true, forNumbers: true, forFilenames: true },
  lists: { useUnordered: true, useOrdered: true, maxNesting: 2, useEmojiMarkers: false },
  blockquotes: { enabled: true, useEmoji: false, frequency: 'low' },
  alerts: { enabled: true, useNote: true, useTip: true, useImportant: true, useWarning: true, useCaution: true, frequency: 'low' },
  other: { useTables: true, useHorizontalRules: true, useCodeBlocks: true },
}

const TIER_DEFAULTS: Record<LayoutPromptTier, VisualPromptConfig> = {
  minimal: MINIMAL_TIER_DEFAULTS,
  standard: STANDARD_TIER_DEFAULTS,
  rich: RICH_TIER_DEFAULTS,
}

const STORAGE_KEY = 'welight_visual_prompt_config_v3'

/** 旧版（v2）三种排版模式的存储结构，仅用于一次性迁移 */
const LEGACY_STORAGE_KEY = 'welight_visual_prompt_config_v2'
interface LegacyConfigs {
  convertSmart?: Partial<VisualPromptConfig>
}

function cloneConfig(config: VisualPromptConfig): VisualPromptConfig {
  return JSON.parse(JSON.stringify(config)) as VisualPromptConfig
}

function deepMerge<T extends object>(base: T, patch: unknown): T {
  const values = patch && typeof patch === 'object' ? patch as Record<string, unknown> : {}
  return Object.fromEntries(Object.entries(base).map(([key, fallback]) => {
    const value = values[key]
    if (fallback && typeof fallback === 'object')
      return [key, deepMerge(fallback, value)]
    if (typeof value !== typeof fallback)
      return [key, fallback]
    if (typeof value === 'string' && !['low', 'medium', 'high'].includes(value))
      return [key, fallback]
    if (typeof value === 'number' && (!Number.isInteger(value) || value < 1 || value > (key === 'maxLevel' ? 6 : 2)))
      return [key, fallback]
    return [key, value]
  })) as T
}

export class VisualPromptConfigManager {
  private configs: Record<LayoutPromptTier, VisualPromptConfig>

  constructor() {
    this.configs = {
      minimal: cloneConfig(MINIMAL_TIER_DEFAULTS),
      standard: cloneConfig(STANDARD_TIER_DEFAULTS),
      rich: cloneConfig(RICH_TIER_DEFAULTS),
    }
    this.loadConfig()
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<LayoutPromptTier, VisualPromptConfig>>
        for (const tier of LAYOUT_PROMPT_TIERS)
          this.configs[tier] = deepMerge(TIER_DEFAULTS[tier], parsed?.[tier])
        return
      }

      // 首次加载 v3 结构：如果用户此前自定义过旧版“智能排版”的可视化配置，
      // 将其整体迁移到“丰富”档，避免用户感觉自定义内容丢失；
      // 旧版“基础排版/极简排版”的配置不再迁移，简约/标准档使用全新预设。
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as LegacyConfigs
        if (legacy?.convertSmart)
          this.configs.rich = deepMerge(RICH_TIER_DEFAULTS, legacy?.convertSmart)
        this.saveConfig()
      }
    }
    catch (error) {
      console.error('加载可视化提示词配置失败:', error)
      this.configs = {
        minimal: cloneConfig(MINIMAL_TIER_DEFAULTS),
        standard: cloneConfig(STANDARD_TIER_DEFAULTS),
        rich: cloneConfig(RICH_TIER_DEFAULTS),
      }
    }
  }

  private saveConfig(): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs))
      return true
    }
    catch (error) {
      console.error('保存可视化提示词配置失败:', error)
      return false
    }
  }

  private normalizeTier(tier: LayoutPromptTier): LayoutPromptTier {
    return (LAYOUT_PROMPT_TIERS as string[]).includes(tier) ? tier : DEFAULT_LAYOUT_PROMPT_TIER
  }

  getConfig(tier: LayoutPromptTier = DEFAULT_LAYOUT_PROMPT_TIER): VisualPromptConfig {
    return cloneConfig(this.configs[this.normalizeTier(tier)])
  }

  updateConfig(partial: Partial<VisualPromptConfig>, tier: LayoutPromptTier = DEFAULT_LAYOUT_PROMPT_TIER) {
    const key = this.normalizeTier(tier)
    this.configs[key] = deepMerge(this.configs[key], partial)
    return this.saveConfig()
  }

  resetConfig(tier: LayoutPromptTier = DEFAULT_LAYOUT_PROMPT_TIER) {
    const key = this.normalizeTier(tier)
    this.configs[key] = cloneConfig(TIER_DEFAULTS[key])
    return this.saveConfig()
  }

  /**
   * 生成“一键排版”提示词
   * - 强调默认提示框使用容器语法 :::（便于风格统一）
   * - 告知新增自定义提示框写法：[!TYPE] 标题（标题取紧随文本），正文需换行
   * - 三个档位共用同一套生成逻辑，差异完全由 VisualPromptConfig 的取值体现
   */
  generatePrompt(tier: LayoutPromptTier = DEFAULT_LAYOUT_PROMPT_TIER): string {
    const key = this.normalizeTier(tier)
    const config = this.configs[key]

    // 是否在提示词标题中使用 emoji（只要任一相关配置开启 emoji 即可）
    const useAnyEmojiInPromptHeadings = !!(
      (config.headings && config.headings.useEmoji)
      || (config.lists && config.lists.useEmojiMarkers)
      || (config.blockquotes && config.blockquotes.useEmoji)
    )

    const tierIntro: Record<LayoutPromptTier, string> = {
      minimal: '整体排版基调：克制、干净、结构分明——像专业编辑做删减，而不是堆砌各种 Markdown 语法元素。能靠留白和语气表达层次的地方，不用标题或强调符号硬堆。\n\n',
      standard: '整体排版基调：结构清晰、可读性好，标题和强调按内容需要使用，不过度堆砌语法元素。\n\n',
      rich: '整体排版基调：视觉层次丰富，可以充分利用标题、强调、引用和提示框来组织内容。\n\n',
    }

    let prompt = '你是一个专业的Markdown格式化专家。请将以下文本转换为结构化的Markdown格式。\n\n'
    prompt += tierIntro[key]
    prompt += '保留原文事实、数字、链接、图片与代码，不编造引语或结论。无需用齐下列格式；原文已经清楚的段落保持原样。\n\n'

    // 核心原则
    prompt += `## ${useAnyEmojiInPromptHeadings ? '📋 ' : ''}核心原则：\n`
    if (config.basic.preserveOriginalMeaning)
      prompt += '1. **保持原文意思不变**：严格保持原文的核心意思\n'
    if (config.basic.optimizeExpression)
      prompt += '2. **优化表达方式**：可以适当调整语句结构，使表达更清晰流畅\n'
    prompt += '3. **提升可读性**：通过合理的格式化，让内容更易于阅读和理解\n\n'

    // 微信公众号规范（固定）
    prompt += `## ${useAnyEmojiInPromptHeadings ? '🚨 ' : ''}微信公众号规范约束（必须严格遵守）：\n\n`
    prompt += '### 列表嵌套规则\n'
    prompt += `- **有序列表和无序列表的嵌套层级均不得超过${config.lists.maxNesting}层**\n`
    prompt += `- 超过${config.lists.maxNesting}层的内容请使用段落分隔、引用块或其他格式替代\n`
    prompt += '- 超出层级时优先拆分为普通段落，不要突破下方标题与引用规则\n\n'

    // 格式化规则
    prompt += `## ${useAnyEmojiInPromptHeadings ? '🎨 ' : ''}格式化规则：\n\n`

    // 标题
    if (config.headings.enabled) {
      prompt += '### 1. 标题结构化\n'
      const freqMap: Record<Frequency, string> = {
        low: '谨慎使用标题，仅对主要章节使用',
        medium: '适度使用标题，平衡内容结构',
        high: '充分利用标题，创建清晰的层次结构',
      }
      prompt += `- ${freqMap[config.headings.frequency]}\n`
      prompt += `- 标题级别不得深于 H${config.headings.maxLevel}；只有原文确有章节划分时才添加标题\n`
      prompt += '- 正文中不要使用一级标题（# 一级标题），文章标题由公众号标题栏单独填写\n'
      if (config.headings.useEmoji)
        prompt += '- 可以在标题中添加适当的emoji增强视觉效果\n'
      else
        prompt += '- 不要在任何标题中使用emoji\n'
      prompt += '\n'
    }
    else {
      prompt += '### 1. 标题结构化\n'
      prompt += '- 不使用任何级别的标题，内容以段落形式呈现\n\n'
    }

    // 文本强调
    const emphasisMethods: string[] = []
    if (config.emphasis.useBold)
      emphasisMethods.push('**粗体**')
    if (config.emphasis.useItalic)
      emphasisMethods.push('*斜体*')
    if (config.emphasis.useBoldItalic)
      emphasisMethods.push('***粗斜体***')
    if (config.emphasis.useStrikethrough)
      emphasisMethods.push('~~删除线~~')

    if (emphasisMethods.length > 0) {
      prompt += '### 2. 文本强调\n'
      const freqMap: Record<Frequency, string> = {
        low: '克制使用，仅对最重要的内容强调',
        medium: '适度使用，平衡强调效果',
        high: '充分使用，突出重要信息',
      }
      prompt += `- 可用方式：${emphasisMethods.join('、')}\n`
      prompt += `- ${freqMap[config.emphasis.frequency]}\n\n`
    }
    else {
      prompt += '### 2. 文本强调\n'
      prompt += '- 不使用粗体、斜体等文本强调，靠句子本身的表达力\n\n'
    }

    // 行内代码
    const inlineCodeUsages: string[] = []
    if (config.inlineCode.forTerms)
      inlineCodeUsages.push('专业术语')
    if (config.inlineCode.forEnglish)
      inlineCodeUsages.push('英文名词')
    if (config.inlineCode.forNumbers)
      inlineCodeUsages.push('数据数值')
    if (config.inlineCode.forFilenames)
      inlineCodeUsages.push('文件名、路径')

    prompt += '### 3. 行内代码\n'
    if (inlineCodeUsages.length > 0)
      prompt += `- 对以下内容使用行内代码格式：${inlineCodeUsages.join('、')}\n\n`
    else
      prompt += '- 不使用行内代码格式\n\n'

    // 列表
    if (config.lists.useUnordered || config.lists.useOrdered) {
      prompt += '### 4. 列表\n'
      if (config.lists.useUnordered)
        prompt += '- 并列内容使用无序列表\n'
      if (config.lists.useOrdered)
        prompt += '- 步骤、流程使用有序列表\n'
      prompt += `- **重要**：列表嵌套最多${config.lists.maxNesting}层\n`
      if (config.lists.useEmojiMarkers)
        prompt += '- 可以使用emoji作为列表标记\n'
      else
        prompt += '- 不要使用emoji作为列表标记，使用标准 “-” 或数字标记\n'
      prompt += '\n'
    }
    else {
      prompt += '### 4. 列表\n'
      prompt += '- 不使用无序列表或有序列表，内容以段落形式呈现\n\n'
    }

    // 引用块
    if (config.blockquotes.enabled) {
      prompt += '### 5. 引用块\n'
      const freqMap: Record<Frequency, string> = {
        low: '仅对全文最关键的一两处金句、结论或注意事项使用引用块，不要滥用',
        medium: '适度使用引用块突出重要内容',
        high: '充分使用引用块组织内容',
      }
      prompt += `- ${freqMap[config.blockquotes.frequency]}\n`
      if (config.blockquotes.useEmoji)
        prompt += '- 可以使用emoji增强视觉效果（如 > ⚠️ 或 > 💡）\n'
      else
        prompt += '- 引用块开头不要放任何emoji\n'
      prompt += '\n'
    }
    else {
      prompt += '### 5. 引用块\n'
      prompt += '- 不使用引用块，相关内容以普通段落形式呈现\n\n'
    }

    // GFM Alert 提示框
    if (config.alerts?.enabled) {
      prompt += '### 6. 提示框（GFM Alert）\n'
      prompt += '- 默认推荐使用**容器语法**创建提示框，格式：\n'
      prompt += '  ```\n'
      prompt += '  ::: tip\n'
      prompt += '  提示内容\n'
      prompt += '  :::\n'
      prompt += '  ```\n'
      prompt += '- 同时支持**自定义标题写法**（我们新增）：\n'
      prompt += '  - 标题取自 `[!TYPE]` 后的紧随文本，正文需**换行**显示\n'
      prompt += '  ```\n'
      prompt += '  > [!TIP] 优势\n'
      prompt += '  > 这是一个优势类型的提示框的正文\n'
      prompt += '  ```\n'

      const alertTypes: string[] = []
      if (config.alerts.useNote)
        alertTypes.push('`[!NOTE]`（笔记：补充信息或备注）')
      if (config.alerts.useTip)
        alertTypes.push('`[!TIP]`（提示：有用的建议或技巧）')
      if (config.alerts.useImportant)
        alertTypes.push('`[!IMPORTANT]`（重要：关键信息）')
      if (config.alerts.useWarning)
        alertTypes.push('`[!WARNING]`（警告：潜在问题）')
      if (config.alerts.useCaution)
        alertTypes.push('`[!CAUTION]`（注意：危险操作提醒）')

      if (alertTypes.length > 0) {
        prompt += `- 可用的提示框类型：\n`
        for (const alertType of alertTypes)
          prompt += `  - ${alertType}\n`
      }

      const freqMap: Record<Frequency, string> = {
        low: '仅在必要时使用提示框，避免过多干扰阅读',
        medium: '适度使用提示框突出重要信息',
        high: '充分利用提示框组织不同类型的信息',
      }
      prompt += `- ${freqMap[config.alerts.frequency]}\n\n`
    }
    else {
      prompt += '### 6. 提示框\n'
      prompt += '- 不使用 GFM Alert 或 ::: 容器提示框语法\n\n'
    }

    // 其他格式
    const otherFormats: string[] = []
    if (config.other.useTables)
      otherFormats.push('表格')
    if (config.other.useHorizontalRules)
      otherFormats.push('分隔线')
    if (config.other.useCodeBlocks)
      otherFormats.push('代码块')

    prompt += '### 7. 其他格式\n'
    if (!config.other.useHorizontalRules)
      prompt += '- 不添加水平分隔线，使用段落留白分隔内容\n'
    if (otherFormats.length > 0) {
      if (config.other.useTables)
        prompt += '- 将适合的数据转换为表格格式\n'
      if (config.other.useHorizontalRules)
        prompt += '- 使用水平分隔线（---）分隔不同主题\n'
      if (config.other.useCodeBlocks)
        prompt += '- 对代码片段使用代码块格式\n'
      prompt += '\n'
    }
    else {
      prompt += '- 不使用表格、分隔线、代码块等额外格式\n\n'
    }

    prompt += `## ${useAnyEmojiInPromptHeadings ? '📝 ' : ''}输出要求：\n`
    prompt += '- 直接返回转换后的Markdown内容\n'
    prompt += '- 不要添加任何说明、解释或额外文字\n'
    prompt += '- 不要用代码块包裹结果\n\n'
    prompt += '待转换文本：\n'
    return prompt
  }
}

