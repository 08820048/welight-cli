import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { rankTitles, scoreTitles } from '../src/titleScore'
import { askJudgment } from '../src/typesafe'

let server: http.Server
let baseUrl = ``
let lastAuth = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastAuth = String(req.headers.authorization ?? ``)
    req.on(`data`, () => {})
    req.on(`end`, () => {
      if ((req.url ?? ``).includes(`/not-found`)) {
        res.writeHead(404, { 'content-type': `application/json` })
        res.end(JSON.stringify({ error: `not found` }))
        return
      }
      res.writeHead(200, { 'content-type': `application/json` })
      res.end(JSON.stringify({
        model: `jev-test`,
        answers: {
          t0: { score: 4.5, confidence: 0.9 },
          t1: { score: 2, confidence: 0.9 },
          t2: { score: 5, confidence: 0.2 },
        },
      }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`标题评分与判断层直连`, () => {
  it(`按得分排序，低置信不计入排名`, async () => {
    const report = await scoreTitles([`标题A`, `标题B`, `标题C`], { apiKey: `good`, endpoint: baseUrl })
    expect(lastAuth).toBe(`Bearer good`)
    expect(report).not.toBeNull()
    expect(report?.model).toBe(`jev-test`)
    expect(report?.ranking.map(entry => entry.title)).toEqual([`标题A`, `标题B`])
    expect(report?.top?.title).toBe(`标题A`)
    expect(report?.unscored.map(entry => entry.title)).toEqual([`标题C`])
  })

  it(`无 API Key 时返回 null（降级）`, async () => {
    expect(await scoreTitles([`A`], { apiKey: `` })).toBeNull()
  })

  it(`rankTitles 纯函数处理缺省回答`, () => {
    const report = rankTitles([`A`, `B`], { t0: { score: 3 } })
    expect(report.ranking.map(entry => entry.title)).toEqual([`A`])
    expect(report.unscored.map(entry => entry.title)).toEqual([`B`])
  })

  it(`上游非 2xx 时 askJudgment 返回 null`, async () => {
    const result = await askJudgment({ x: 1 }, { q: { type: `score`, instructions: `i`, criteria: [`a`] } }, {
      apiKey: `k`,
      endpoint: `${baseUrl}/not-found`,
    })
    expect(result).toBeNull()
  })
})
