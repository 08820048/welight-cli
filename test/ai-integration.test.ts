import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runAgent } from '../src/ai/agent'

let server: http.Server
let baseUrl = ``
let requestCount = 0
let secondBody = ``

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on(`data`, chunk => chunks.push(Buffer.from(chunk)))
    req.on(`end`, () => {
      requestCount += 1
      res.writeHead(200, { 'content-type': `application/json` })
      if (requestCount === 1) {
        // 第一步：模型要求调用规则扫描工具
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: `assistant`,
              content: null,
              tool_calls: [{
                id: `call_1`,
                type: `function`,
                function: { name: `check_wechat_rules`, arguments: `{}` },
              }],
            },
          }],
        }))
        return
      }
      secondBody = Buffer.concat(chunks).toString(`utf8`)
      res.end(JSON.stringify({
        choices: [{ message: { role: `assistant`, content: `检查完成：存在标题党风险。` } }],
      }))
    })
  })
  await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe(`ai agent 工具循环`, () => {
  it(`先调用工具，再给出最终答复`, async () => {
    const events: string[] = []
    const result = await runAgent({
      prompt: `检查这篇文章的风险`,
      content: `# 震惊\n\n领取红包`,
      baseUrl,
      apiKey: `k`,
      model: `test-model`,
      onEvent: message => events.push(message),
    })

    expect(result).toBe(`检查完成：存在标题党风险。`)
    expect(requestCount).toBe(2)
    expect(events).toContain(`调用工具 check_wechat_rules`)
    // 第二次请求应包含工具执行结果
    expect(secondBody).toContain(`"role":"tool"`)
    expect(secondBody).toContain(`命中`)
  })
})
