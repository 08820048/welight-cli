import { describe, expect, it } from 'vitest'
import { buildCheckupItems } from '../src/checkup'

describe(`checkup 判定`, () => {
  it(`good 方向：高概率良好，低概率关注`, () => {
    const items = buildCheckupItems({
      hook: { noul: 0.9 },
      conclusion: { noul: 0.1 },
      structure: { score: 3, confidence: 0.9 },
    })
    const byId = Object.fromEntries(items.map(item => [item.id, item]))
    expect(byId.hook.status).toBe(`pass`)
    expect(byId.conclusion.status).toBe(`watch`)
    expect(byId.structure.status).toBe(`pass`)
  })

  it(`bad 方向：高概率建议处理`, () => {
    const items = buildCheckupItems({ long_paragraphs: { noul: 0.8 } })
    expect(items.find(item => item.id === `long_paragraphs`)?.status).toBe(`action`)
  })

  it(`低置信度的 score 记为未判定`, () => {
    const items = buildCheckupItems({ readability: { score: 4, confidence: 0.2 } })
    expect(items.find(item => item.id === `readability`)?.status).toBe(`unknown`)
  })

  it(`共 12 项`, () => {
    expect(buildCheckupItems({})).toHaveLength(12)
  })
})
