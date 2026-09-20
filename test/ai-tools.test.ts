import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AI_TOOLS } from '../src/ai/tools'
import { installDom } from '../src/dom'

installDom()

function tool(name: string) {
  const found = AI_TOOLS.find(item => item.name === name)
  if (!found)
    throw new Error(`missing tool ${name}`)
  return found
}

const originalTypesafeKey = process.env.WELIGHT_TYPESAFE_KEY

beforeEach(() => {
  delete process.env.WELIGHT_TYPESAFE_KEY
})

afterEach(() => {
  if (originalTypesafeKey === undefined)
    delete process.env.WELIGHT_TYPESAFE_KEY
  else
    process.env.WELIGHT_TYPESAFE_KEY = originalTypesafeKey
})

describe(`ai 工具集`, () => {
  it(`包含预期的工具`, () => {
    const names = AI_TOOLS.map(item => item.name).sort()
    expect(names).toEqual([`article_stats`, `check_wechat_rules`, `detect_ai_text`, `list_themes`, `render_article`, `render_document`, `score_titles`])
  })

  it(`list_themes 返回免费主题`, async () => {
    const result = await tool(`list_themes`).run({}, { content: `` })
    expect(result).toContain(`w001`)
    expect(result).toContain(`13 套`)
  })

  it(`check_wechat_rules 返回扫描结果`, async () => {
    const result = await tool(`check_wechat_rules`).run({}, { content: `震惊！领取红包` })
    expect(result).toContain(`命中`)
  })

  it(`render_article 用主题渲染并保存文件`, async () => {
    const out = path.join(os.tmpdir(), `welight-ai-render-${Date.now()}.html`)
    const result = await tool(`render_article`).run({ theme: `w011`, out }, { content: `# 标题\n\n正文` })
    expect(result).toContain(out)
    expect(fs.existsSync(out)).toBe(true)
    const html = fs.readFileSync(out, `utf8`)
    expect(html.length).toBeGreaterThan(100)
    fs.rmSync(out, { force: true })
  })

  it(`article_stats 统计篇幅`, async () => {
    const result = await tool(`article_stats`).run({}, { content: `# 标题\n\n正文内容 ![图](a.png) [链接](https://x.com)\n\n\`\`\`js\nconst a=1\n\`\`\`` })
    expect(result).toContain(`标题 1 个`)
    expect(result).toContain(`图片 1`)
    expect(result).toContain(`代码块 1`)
  })

  it(`render_document 输出独立 HTML`, async () => {
    const out = path.join(os.tmpdir(), `welight-ai-doc-${Date.now()}.html`)
    const result = await tool(`render_document`).run({ theme: `w001`, out }, { content: `# 标题\n\n正文` })
    expect(result).toContain(out)
    const html = fs.readFileSync(out, `utf8`)
    expect(html).toContain(`<!doctype html>`)
    fs.rmSync(out, { force: true })
  })

  it(`score_titles 无 Key 时给出降级提示`, async () => {
    const result = await tool(`score_titles`).run({ titles: [`A`, `B`] }, { content: `` })
    expect(result).toContain(`WELIGHT_TYPESAFE_KEY`)
  })
})
