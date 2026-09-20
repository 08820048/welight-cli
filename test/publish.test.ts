import { describe, expect, it } from 'vitest'
import { installDom } from '../src/dom'
import { inferTitle, sanitizeArticleTitle } from '../src/publish'
import { appendWatermark } from '../src/watermark'
import { WechatApiError } from '../src/wechatApi'

installDom()

describe(`publish helpers`, () => {
  it(`从 front-matter 推断标题`, () => {
    expect(inferTitle(`---\ntitle: 我的标题\n---\n\n正文`, `兜底`)).toBe(`我的标题`)
  })

  it(`从一级标题推断标题`, () => {
    expect(inferTitle(`# 标题A\n\n正文`, `兜底`)).toBe(`标题A`)
  })

  it(`无标题时回退`, () => {
    expect(inferTitle(`正文`, `兜底`)).toBe(`兜底`)
  })

  it(`标题清洗与长度校验`, () => {
    expect(sanitizeArticleTitle(`a/b:c`)).toBe(`a_b_c`)
    expect(() => sanitizeArticleTitle(`x`.repeat(65))).toThrow(/64/)
    expect(() => sanitizeArticleTitle(`   `)).toThrow()
  })

  it(`水印只追加一次`, () => {
    const once = appendWatermark(`<p>正文</p>`)
    expect(once).toContain(`welight.fyi`)
    const twice = appendWatermark(once)
    expect((twice.match(/data-welight-watermark/g) ?? []).length).toBe(1)
  })

  it(`40164 给出 IP 白名单提示`, () => {
    const error = new WechatApiError(40164, `invalid ip`)
    expect(error.message).toContain(`IP 白名单`)
  })
})
