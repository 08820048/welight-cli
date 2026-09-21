import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentContext } from '../src/ai/tools'
import { AI_TOOLS } from '../src/ai/tools'
import { installDom } from '../src/dom'

installDom()

function tool(name: string) {
  const found = AI_TOOLS.find(item => item.name === name)
  if (!found)
    throw new Error(`missing tool ${name}`)
  return found
}

const KEYS = [`WELIGHT_WECHAT_APP_ID`, `WELIGHT_WECHAT_APP_SECRET`] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
})

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return { content: `# 标题\n\n正文`, baseDir: process.cwd(), theme: `w001`, ...overrides }
}

describe(`publish_draft 工具`, () => {
  it(`缺少公众号凭据时给出配置提示`, async () => {
    const result = await tool(`publish_draft`).run({}, context())
    expect(result).toContain(`公众号凭据`)
    expect(result).toContain(`wechat-app-id`)
  })

  it(`用户取消时不发布`, async () => {
    process.env.WELIGHT_WECHAT_APP_ID = `wx_test`
    process.env.WELIGHT_WECHAT_APP_SECRET = `secret_test`
    const result = await tool(`publish_draft`).run({}, context({ confirm: async () => false }))
    expect(result).toContain(`取消`)
  })

  it(`无内容时提示`, async () => {
    process.env.WELIGHT_WECHAT_APP_ID = `wx_test`
    process.env.WELIGHT_WECHAT_APP_SECRET = `secret_test`
    const result = await tool(`publish_draft`).run({}, context({ content: `   `, confirm: async () => true }))
    expect(result).toContain(`没有可发布`)
  })
})
