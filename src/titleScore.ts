/**
 * 标题判题（CLI 版）：把候选标题交给 TypeSafe 判断层按「公众号打开潜力」打分（1-5 级）。
 * 评分标准与 GUI 的 titleScoreTool 保持一致。
 */

import type { TypeSafeAnswer } from './typesafe'
import { answerScore, askJudgment } from './typesafe'

export const TITLE_SCORE_CRITERIA = [
  `平淡，几乎没有打开欲望`,
  `一般，信息平淡`,
  `较有吸引力`,
  `很有吸引力，想点进去看`,
  `爆款潜力，强点击欲望`,
]

export const MAX_TITLES = 10
export const MIN_TITLE_SCORE_CONFIDENCE = 0.4

export interface TitleScoreEntry {
  title: string
  score?: number
  confidence?: number
  scored: boolean
}

export interface TitleScoreReport {
  ranking: TitleScoreEntry[]
  unscored: TitleScoreEntry[]
  top?: TitleScoreEntry
  model?: string
}

/** 纯函数：回答集 → 排名 */
export function rankTitles(titles: string[], answers: Record<string, TypeSafeAnswer> | undefined): TitleScoreReport {
  const scored: TitleScoreEntry[] = []
  const unscored: TitleScoreEntry[] = []
  titles.forEach((title, index) => {
    const answer = answers?.[`t${index}`]
    const score = answerScore(answer)
    const confidence = typeof answer?.confidence === `number` ? answer.confidence : undefined
    const usable = typeof score === `number` && (typeof confidence !== `number` || confidence >= MIN_TITLE_SCORE_CONFIDENCE)
    const entry: TitleScoreEntry = { title, score: usable ? score : undefined, confidence, scored: usable }
    if (usable)
      scored.push(entry)
    else
      unscored.push(entry)
  })
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return { ranking: scored, unscored, top: scored[0] }
}

export interface ScoreTitlesOptions {
  apiKey: string
  endpoint?: string
  timeoutMs?: number
}

/** 调用判断层评分；不可用或失败时返回 null，由调用方降级 */
export async function scoreTitles(titles: string[], options: ScoreTitlesOptions): Promise<TitleScoreReport | null> {
  const candidates = [...new Set(titles.map(title => title.trim()).filter(Boolean))].slice(0, MAX_TITLES)
  if (candidates.length === 0)
    return null

  const questions: Record<string, { type: `score`, instructions: string, criteria: string[] }> = {}
  candidates.forEach((title, index) => {
    questions[`t${index}`] = {
      type: `score`,
      instructions: `评估这个微信公众号文章标题的打开潜力（标题：「${title}」）。`,
      criteria: TITLE_SCORE_CRITERIA,
    }
  })

  const response = await askJudgment({ titles: candidates }, questions, {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
    timeoutMs: options.timeoutMs,
  })
  if (!response?.answers)
    return null

  const report = rankTitles(candidates, response.answers)
  report.model = typeof response.model === `string` ? response.model : undefined
  return report
}
