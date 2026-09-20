import { describe, expect, it } from 'vitest'
import { installDom } from '../src/dom'
import { buildWeChatInlineHtml, htmlToPlainText, loadCodeThemeCss } from '../src/wechat'

installDom()

const MARKDOWN = `# 标题

正文 **加粗** 与 \`代码\`。

- 列表一
- 列表二
`

describe(`wechat inline`, () => {
  it(`内联主题样式并移除 style 标签`, () => {
    const html = buildWeChatInlineHtml(MARKDOWN, {
      theme: `w001`,
      primaryColor: `#4876b8`,
      fontSize: `16px`,
    })
    expect(html).not.toContain(`<style`)
    expect(html).not.toContain(`<link`)
    expect(html).toContain(`style="`)
    expect(html).toContain(`标题`)
  })

  it(`本地读取 highlight.js 代码主题`, () => {
    const css = loadCodeThemeCss(`github-dark`)
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain(`.hljs`)
  })

  it(`none 关闭代码主题`, () => {
    expect(loadCodeThemeCss(`none`)).toBe(``)
  })

  it(`纯文本兜底`, () => {
    const text = htmlToPlainText(`<p>你好 <b>世界</b></p>`)
    expect(text).toContain(`你好`)
    expect(text).toContain(`世界`)
  })
})
