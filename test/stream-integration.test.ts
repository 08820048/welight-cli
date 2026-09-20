import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chatCompletionStream } from '../src/modelClient'

let server: http.Server
let baseUrl = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.on(`data`, () => {})
    req.on(`end`, () => {
      res.writeHead(200, { 'content-type': `text/event-stream` })
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `你好` } }] })}\n\n`)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `，世界` } }] })}\n\n`)
      res.write(`data: [DONE]\n\n`)
      res.end()
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`流式输出`, () => {
  it(`按增量回调并拼接完整内容`, async () => {
    const deltas: string[] = []
    const message = await chatCompletionStream(
      { baseUrl, apiKey: `k`, model: `m`, messages: [{ role: `user`, content: `hi` }] },
      text => deltas.push(text),
    )
    expect(deltas).toEqual([`你好`, `，世界`])
    expect(message.content).toBe(`你好，世界`)
    expect(message.tool_calls).toBeUndefined()
  })
})
