import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildLayoutPrompt, resolveLayoutTier, runLayout } from '../src/layout'

let server: http.Server
let baseUrl = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.on(`data`, () => {})
    req.on(`end`, () => {
      res.writeHead(200, { 'content-type': `application/json` })
      res.end(JSON.stringify({ choices: [{ message: { content: `# 已排版\n\n正文段落。` } }] }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`layout`, () => {
  it(`生成一键排版提示词`, () => {
    const prompt = buildLayoutPrompt(`minimal`)
    expect(prompt).toContain(`Markdown`)
    expect(prompt.length).toBeGreaterThan(200)
  })

  it(`auto 档无判断层 Key 时回退简约`, async () => {
    const result = await resolveLayoutTier(`正文`, `auto`, { apiKey: `` })
    expect(result.tier).toBe(`minimal`)
    expect(result.recommended).toBe(false)
  })

  it(`手动档位直接生效`, async () => {
    const result = await resolveLayoutTier(`正文`, `rich`, { apiKey: `` })
    expect(result.tier).toBe(`rich`)
  })

  it(`runLayout 调用模型并返回 Markdown`, async () => {
    const result = await runLayout(`# 原文\n\n正文`, {
      tier: `minimal`,
      model: { baseUrl, apiKey: `k`, model: `m` },
      typesafe: { apiKey: `` },
    })
    expect(result.tier).toBe(`minimal`)
    expect(result.markdown).toContain(`已排版`)
  })
})
