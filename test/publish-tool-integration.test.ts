import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AgentContext } from '../src/ai/tools'
import { AI_TOOLS } from '../src/ai/tools'
import { saveConfigValues } from '../src/config'
import { installDom } from '../src/dom'

installDom()

const ONE_PX_PNG = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`

let server: http.Server
let baseUrl = ``
let dir = ``
let prevCwd = ``

function tool(name: string) {
  const found = AI_TOOLS.find(item => item.name === name)
  if (!found)
    throw new Error(`missing tool ${name}`)
  return found
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = (req.url ?? ``).split(`?`)[0]
    req.on(`data`, () => {})
    req.on(`end`, () => {
      const send = (payload: unknown) => {
        res.writeHead(200, { 'content-type': `application/json` })
        res.end(JSON.stringify(payload))
      }
      if (url === `/cgi-bin/stable_token`)
        return send({ access_token: `TOKEN` })
      if (url === `/cgi-bin/material/add_material`)
        return send({ media_id: `COVER_ID`, url: `https://mmbiz.example/cover.png` })
      if (url === `/cgi-bin/media/uploadimg`)
        return send({ url: `https://mmbiz.example/inline.png` })
      if (url === `/cgi-bin/draft/add`)
        return send({ media_id: `DRAFT_MEDIA_ID` })
      if (url === `/cgi-bin/draft/get`)
        return send({ news_item: [{ url: `https://mp.weixin.qq.com/s/FAKE` }] })
      res.writeHead(404)
      res.end(`nope`)
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  dir = fs.mkdtempSync(path.join(os.tmpdir(), `wl-pub-tool-`))
  saveConfigValues({ proxy: baseUrl, theme: `w001` }, dir)
  prevCwd = process.cwd()
  process.chdir(dir)
  process.env.WELIGHT_WECHAT_APP_ID = `wx_test`
  process.env.WELIGHT_WECHAT_APP_SECRET = `secret_test`
})

afterAll(async () => {
  process.chdir(prevCwd)
  fs.rmSync(dir, { recursive: true, force: true })
  delete process.env.WELIGHT_WECHAT_APP_ID
  delete process.env.WELIGHT_WECHAT_APP_SECRET
  await new Promise<void>(resolve => server.close(() => resolve()))
})

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  const content = `# AI 发布的文章\n\n正文 ![图](data:image/png;base64,${ONE_PX_PNG})\n`
  return { content, baseDir: dir, theme: `w001`, confirm: async () => true, ...overrides }
}

describe(`publish_draft 集成`, () => {
  it(`确认后创建草稿并返回预览链接`, async () => {
    const result = await tool(`publish_draft`).run({ preview: true }, context())
    expect(result).toContain(`草稿创建成功`)
    expect(result).toContain(`DRAFT_MEDIA_ID`)
    expect(result).toContain(`https://mp.weixin.qq.com/s/FAKE`)
  })

  it(`用户拒绝时不创建草稿`, async () => {
    const result = await tool(`publish_draft`).run({}, context({ confirm: async () => false }))
    expect(result).toContain(`取消`)
  })
})
