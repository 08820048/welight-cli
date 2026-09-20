import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aiRatio, detectAiText } from '../src/zhuqueApi'

let server: http.Server
let baseUrl = ``
let lastAuth = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastAuth = String(req.headers.authorization ?? ``)
    const chunks: Buffer[] = []
    req.on(`data`, chunk => chunks.push(Buffer.from(chunk)))
    req.on(`end`, () => {
      if (lastAuth !== `Bearer good-key`) {
        res.writeHead(401, { 'content-type': `application/json` })
        res.end(JSON.stringify({ message: `unauthorized` }))
        return
      }
      res.writeHead(200, { 'content-type': `application/json` })
      res.end(JSON.stringify({
        status: `success`,
        softmax_confidence: 0.3,
        ratio_confidence: 0.35,
        labels_ratio: { 0: 0.6, 1: 0.3, 2: 0.1 },
        segment_labels: [
          { text: `第二段`, label: `1`, conf: 0.9, order: 1, position: 10 },
          { text: `第一段`, label: `0`, conf: 0.8, order: 0, position: 0 },
        ],
      }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`detect 集成`, () => {
  it(`直连网关并整理分段报告`, async () => {
    const report = await detectAiText(`# 标题\n\n正文内容`, { apiKey: `good-key`, endpoint: baseUrl })
    expect(lastAuth).toBe(`Bearer good-key`)
    expect(report.result.status).toBe(`success`)
    expect(report.detectedChars).toBeGreaterThan(0)
    expect(aiRatio(report)).toBeCloseTo(0.4, 5)
    // 分段按 position 排序
    expect(report.result.segment_labels[0]?.text).toBe(`第一段`)
  })

  it(`Key 无效时给出可读错误`, async () => {
    await expect(
      detectAiText(`正文`, { apiKey: `bad-key`, endpoint: baseUrl }),
    ).rejects.toThrow(/无效或已过期/)
  })

  it(`空内容直接报错`, async () => {
    await expect(detectAiText(`   `, { apiKey: `good-key`, endpoint: baseUrl })).rejects.toThrow(/内容为空/)
  })
})
