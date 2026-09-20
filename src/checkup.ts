/**
 * 文章体检（CLI 版）：一次判断请求并行发出 Noul / Score 问题，
 * 从开头钩子、结构、过渡、长段落、重复、术语、表格/图表机会、可读性、
 * 收尾与互动引导、标题一致性等维度产出量化体检报告。
 *
 * 问题集与判定逻辑与桌面端 articleCheckupTool 对齐（复制实现，不改 GUI）。
 * 需要用户自配 TypeSafe Key，否则不可用。
 */

import type { TypeSafeAnswer, TypeSafeQuestion } from './typesafe'
import { answerProbability, answerScore, askJudgment } from './typesafe'

const CHECKUP_STATE_MAX_CHARS = 12_000

interface CheckupQuestion {
  id: string
  label: string
  kind: `noul`
  instructions: string
  /** good：回答「是」代表文章具备该优点；bad：回答「是」代表存在该问题 */
  direction: `good` | `bad`
  suggestion: string
}

interface CheckupLevelQuestion {
  id: string
  label: string
  kind: `score`
  instructions: string
  criteria: string[]
  /** 得分映射：>= pass 为良好，>= watch 为关注，其余建议处理 */
  pass: number
  watch: number
  suggestion: string
}

const CHECKUP_QUESTIONS: Array<CheckupQuestion | CheckupLevelQuestion> = [
  {
    id: `hook`,
    label: `开头吸引力`,
    kind: `noul`,
    direction: `good`,
    instructions: `文章开头（前五分之一）是否快速给出读者明确的阅读价值、悬念或结论？`,
    suggestion: `开头前几段直接抛出结论、问题或收益点，让读者 10 秒内知道能获得什么。`,
  },
  {
    id: `structure`,
    label: `结构清晰度`,
    kind: `score`,
    instructions: `评估全文结构（段落组织、小标题、逻辑推进）的清晰程度。`,
    criteria: [`结构松散，段落间缺乏逻辑`, `基本有结构但层次不清`, `结构清晰，层次分明`, `结构严谨，逻辑推进自然`],
    pass: 3,
    watch: 2,
    suggestion: `用小标题或序号把内容拆成 2-4 个清晰的部分，每部分聚焦一个要点。`,
  },
  {
    id: `transitions`,
    label: `段落过渡`,
    kind: `noul`,
    direction: `bad`,
    instructions: `是否存在缺少过渡、上下文跳跃断裂的相邻段落？`,
    suggestion: `在断裂的段落之间补一句承上启下的过渡，或调整段落顺序。`,
  },
  {
    id: `long_paragraphs`,
    label: `长段落`,
    kind: `noul`,
    direction: `bad`,
    instructions: `是否存在明显过长（手机上超过约一屏）应当拆分的段落？`,
    suggestion: `把超长段落按意思拆成 2-3 个短段落，移动端阅读体验会明显变好。`,
  },
  {
    id: `repetition`,
    label: `重复表述`,
    kind: `noul`,
    direction: `bad`,
    instructions: `是否存在意思重复的表述或可以删除的冗余内容？`,
    suggestion: `删除重复表达的意思，只保留说得最好的一处。`,
  },
  {
    id: `jargon`,
    label: `未解释术语`,
    kind: `noul`,
    direction: `bad`,
    instructions: `是否存在未做任何解释的专业术语、缩写或行话？`,
    suggestion: `给首次出现的术语补一句通俗解释或类比。`,
  },
  {
    id: `data_table`,
    label: `表格机会`,
    kind: `noul`,
    direction: `good`,
    instructions: `是否存在多项并列的对比、配置或数据列举，转成表格后会更清晰？`,
    suggestion: `把并列的对比/列举内容整理成 Markdown 表格。`,
  },
  {
    id: `data_chart`,
    label: `图表机会`,
    kind: `noul`,
    direction: `good`,
    instructions: `是否存在适合转换为流程图、时序图等图表的过程或关系描述？`,
    suggestion: `把流程或关系描述转成 Mermaid 图表。`,
  },
  {
    id: `readability`,
    label: `整体可读性`,
    kind: `score`,
    instructions: `评估全文的阅读流畅度（句子长度、用词难度、节奏）。`,
    criteria: [`很难读懂，句子冗长晦涩`, `读起来比较费力`, `流畅易读`, `非常流畅，一气呵成`],
    pass: 3,
    watch: 2,
    suggestion: `拆长句、换短词，把书面腔改成口语化表达，一段只说一件事。`,
  },
  {
    id: `conclusion`,
    label: `收尾总结`,
    kind: `noul`,
    direction: `good`,
    instructions: `文章结尾是否有明确的总结、观点收束或行动建议？`,
    suggestion: `结尾用三五句话收束全文观点，或给读者一个明确的下一步。`,
  },
  {
    id: `cta`,
    label: `互动引导`,
    kind: `noul`,
    direction: `bad`,
    instructions: `文末是否缺少自然的互动引导（如提问读者、邀请留言讨论）？注意：强推点赞转发的诱导话术也算存在风险。`,
    suggestion: `文末加一句开放式提问邀请读者留言，比单纯求赞更有效也更安全。`,
  },
  {
    id: `title_match`,
    label: `标题一致性`,
    kind: `noul`,
    direction: `good`,
    instructions: `结合给出的标题，正文内容是否确实围绕标题承诺的主题展开？`,
    suggestion: `调整标题使其贴合正文主旨，或补充正文回应标题的承诺，避免被判定标题党。`,
  },
]

export type CheckupStatus = `pass` | `watch` | `action` | `unknown`

export interface ArticleCheckupItem {
  id: string
  label: string
  kind: `check` | `level`
  probability?: number
  score?: number
  confidence?: number
  status: CheckupStatus
  suggestion: string
}

export interface ArticleCheckupReport {
  model?: string
  sampledChars: number
  truncated: boolean
  items: ArticleCheckupItem[]
  counts: Record<CheckupStatus, number>
}

/** 纯函数：回答集 → 体检条目 */
export function buildCheckupItems(answers: Record<string, TypeSafeAnswer> | undefined): ArticleCheckupItem[] {
  const items: ArticleCheckupItem[] = []
  for (const question of CHECKUP_QUESTIONS) {
    const answer = answers?.[question.id]
    const confidence = typeof answer?.confidence === `number` ? answer.confidence : undefined
    if (question.kind === `noul`) {
      const probability = answerProbability(answer)
      let status: CheckupStatus = `unknown`
      if (typeof probability === `number`) {
        const present = probability >= 0.5
        const strong = probability >= 0.7
        if (question.direction === `good`)
          status = present ? (strong ? `pass` : `watch`) : (probability <= 0.3 ? `watch` : `pass`)
        else
          status = present ? (strong ? `action` : `watch`) : `pass`
      }
      items.push({ id: question.id, label: question.label, kind: `check`, probability, confidence, status, suggestion: question.suggestion })
    }
    else {
      const score = answerScore(answer)
      let status: CheckupStatus = `unknown`
      if (typeof score === `number` && (typeof confidence !== `number` || confidence >= 0.4))
        status = score >= question.pass ? `pass` : score >= question.watch ? `watch` : `action`
      items.push({ id: question.id, label: question.label, kind: `level`, score, confidence, status, suggestion: question.suggestion })
    }
  }
  return items
}

function summarize(items: ArticleCheckupItem[]): Record<CheckupStatus, number> {
  const counts: Record<CheckupStatus, number> = { pass: 0, watch: 0, action: 0, unknown: 0 }
  for (const item of items)
    counts[item.status] += 1
  return counts
}

export interface CheckupOptions {
  title?: string
  apiKey: string
  endpoint?: string
  timeoutMs?: number
}

export async function runCheckup(text: string, options: CheckupOptions): Promise<ArticleCheckupReport> {
  const content = text.slice(0, CHECKUP_STATE_MAX_CHARS)
  const truncated = text.length > content.length
  if (!content.trim())
    throw new Error(`文章内容为空，无需体检`)

  const questions: Record<string, TypeSafeQuestion> = {}
  for (const question of CHECKUP_QUESTIONS) {
    questions[question.id] = question.kind === `noul`
      ? { type: `noul`, instructions: question.instructions }
      : { type: `score`, instructions: question.instructions, criteria: question.criteria }
  }

  const state = options.title ? { title: options.title, article: content } : { article: content }
  const response = await askJudgment(state, questions, {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
    timeoutMs: options.timeoutMs ?? 15_000,
  })
  if (!response?.answers)
    throw new Error(`判断层请求失败，文章体检暂时无法执行`)

  const items = buildCheckupItems(response.answers)
  return {
    model: typeof response.model === `string` ? response.model : undefined,
    sampledChars: content.length,
    truncated,
    items,
    counts: summarize(items),
  }
}
