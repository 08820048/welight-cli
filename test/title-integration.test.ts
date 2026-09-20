import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chatCompletion, parseTitleList } from '../src/modelClient'

let server: http.Server
let baseUrl = ``
let lastAuth = ``
let lastBody = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastAuth = String(req.headers.authorization ?? ``)
    const chunks: Buffer[] = []
    req.on(`data`, chunk => chunks.push(Buffer.from(chunk)))
    req.on(`end`, () => {
      lastBody = Buffer.concat(chunks).toString(`utf8`)
      if (lastAuth !== `Bearer good-key`) {
        res.writeHead(401, { 'content-type': `application/json` })
        res.end(JSON.stringify({ error: { message: `bad key` } }))
        return
      }
      res.writeHead(200, { 'content-type': `application/json` })
      res.end(JSON.stringify({
        choices: [{ message: { content: `1. 标题甲\n2. 标题乙\n- “标题丙”\n\n` } }],
      }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`title 模型接入`, () => {
  it(`调用 OpenAI 兼容接口并解析标题列表`, async () => {
    const raw = await chatCompletion({
      baseUrl,
      apiKey: `good-key`,
      model: `test-model`,
      messages: [{ role: `user`, content: `请生成标题` }],
    })
    expect(lastAuth).toBe(`Bearer good-key`)
    expect(lastBody).toContain(`"model":"test-model"`)

    const titles = parseTitleList(raw)
    expect(titles).toEqual([`标题甲`, `标题乙`, `标题丙`])
  })

  it(`Key 无效时报错`, async () => {
    await expect(
      chatCompletion({ baseUrl, apiKey: `bad-key`, model: `m`, messages: [{ role: `user`, content: `x` }] }),
    ).rejects.toThrow(/无效或已过期/)
  })

  it(`解析去掉编号、项目符号与引号`, () => {
    expect(parseTitleList(`### 标题A\n2、标题B\n* 标题C\n\n`)).toEqual([`标题A`, `标题B`, `标题C`])
  })
})
