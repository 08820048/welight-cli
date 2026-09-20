import { describe, expect, it } from 'vitest'
import { scanWechatRules } from '../src/engine'
import { RULES_DATA, RULES_VERSION } from '../src/rulesData'

describe(`lint 规则扫描`, () => {
  it(`内置规则库可用`, () => {
    expect(RULES_VERSION).toBeTruthy()
    expect(RULES_DATA.rules.length).toBeGreaterThan(0)
    expect(RULES_DATA.categories.length).toBeGreaterThan(0)
  })

  it(`命中标题党线索`, () => {
    const report = scanWechatRules({ title: `震惊！`, content: `正文` }, RULES_DATA)
    expect(report.issues.length).toBeGreaterThan(0)
    expect(report.issues.some(issue => issue.span.text.includes(`震惊`))).toBe(true)
  })

  it(`干净内容不命中`, () => {
    const report = scanWechatRules({ content: `这是一段普通的正文内容。` }, RULES_DATA)
    expect(report.issues.length).toBe(0)
  })
})
