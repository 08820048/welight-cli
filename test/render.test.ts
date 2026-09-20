import { describe, expect, it } from 'vitest'
import { installDom } from '../src/dom'
import { assertFreeTheme, buildThemeCss, isFreeTheme, renderDocument } from '../src/render'

installDom()

const SAMPLE = `# 标题

正文 **加粗** 与 *斜体*。

- 列表项一
- 列表项二

> 引用块

\`\`\`js
const a = 1
\`\`\`
`

describe(`render`, () => {
  it(`渲染出带标题与主题变量的完整 HTML`, () => {
    const html = renderDocument(SAMPLE, { theme: `w001` })
    expect(html).toContain(`<!doctype html>`)
    expect(html).toContain(`<h1`)
    expect(html).toContain(`--md-primary-color`)
    expect(html).toContain(`id="output"`)
  })

  it(`免费主题可用`, () => {
    expect(isFreeTheme(`w001`)).toBe(true)
    expect(isFreeTheme(`w011`)).toBe(true)
  })

  it(`pro 主题被拒绝`, () => {
    expect(isFreeTheme(`w017`)).toBe(false)
    expect(() => assertFreeTheme(`w017`)).toThrow(/只提供免费主题/)
  })

  it(`主题 CSS 包含选择器`, () => {
    const css = buildThemeCss({ theme: `w001` })
    expect(css.length).toBeGreaterThan(100)
    expect(css).toContain(`--md-primary-color`)
  })
})
