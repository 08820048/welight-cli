import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { installDom } from '../src/dom'
import { publishDraft } from '../src/publish'

installDom()

/** 1x1 透明 PNG，作为 data URL 图片源 */
const ONE_PX_PNG
  = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`

let server: http.Server
let baseUrl = ``
const calls: string[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = (req.url ?? ``).split(`?`)[0]
    calls.push(`${req.method} ${path}`)
    const send = (payload: unknown) => {
      res.writeHead(200, { 'content-type': `application/json` })
      res.end(JSON.stringify(payload))
    }
    req.on(`data`, () => {})
    req.on(`end`, () => {
      if (path === `/cgi-bin/stable_token`)
        return send({ access_token: `FAKE_TOKEN`, expires_in: 7200 })
      if (path === `/cgi-bin/material/add_material`)
        return send({ media_id: `COVER_MEDIA_ID`, url: `https://mmbiz.example.com/cover.png` })
      if (path === `/cgi-bin/media/uploadimg`)
        return send({ url: `https://mmbiz.example.com/inline.png` })
      if (path === `/cgi-bin/draft/add`)
        return send({ media_id: `DRAFT_MEDIA_ID` })
      if (path === `/cgi-bin/draft/get`)
        return send({ news_item: [{ url: `https://mp.weixin.qq.com/s/FAKE` }] })
      res.writeHead(404)
      res.end(`not found`)
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`publishDraft 集成`, () => {
  it(`走完 token -> 封面 -> 正文图 -> 草稿 -> 预览 全流程`, async () => {
    const markdown = `# 集成标题\n\n正文 **加粗**。\n\n![配图](data:image/png;base64,${ONE_PX_PNG})\n`
    const result = await publishDraft(markdown, {
      baseDir: process.cwd(),
      credentials: { appId: `appid`, appSecret: `secret`, proxy: baseUrl },
      theme: `w001`,
      watermark: false,
      preview: true,
    })

    expect(result.title).toBe(`集成标题`)
    expect(result.mediaId).toBe(`DRAFT_MEDIA_ID`)
    expect(result.previewUrl).toBe(`https://mp.weixin.qq.com/s/FAKE`)
    expect(result.uploadedContentImageCount).toBe(1)
    expect(calls).toContain(`POST /cgi-bin/stable_token`)
    expect(calls).toContain(`POST /cgi-bin/material/add_material`)
    expect(calls).toContain(`POST /cgi-bin/media/uploadimg`)
    expect(calls).toContain(`POST /cgi-bin/draft/add`)
    expect(calls).toContain(`POST /cgi-bin/draft/get`)
  })
})
