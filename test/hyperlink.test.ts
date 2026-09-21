import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  delete process.env.FORCE_HYPERLINK
})

describe(`终端超链接`, () => {
  it(`FORCE_HYPERLINK=1 时输出 OSC 8`, async () => {
    process.env.FORCE_HYPERLINK = `1`
    const { link } = await import('../src/hyperlink')
    const output = link(`welight.fyi`, `https://welight.fyi`)
    expect(output).toContain(`\u001B]8;;https://welight.fyi`)
    expect(output).toContain(`welight.fyi`)
  })

  it(`FORCE_HYPERLINK=0 时输出纯文本`, async () => {
    process.env.FORCE_HYPERLINK = `0`
    const { link } = await import('../src/hyperlink')
    expect(link(`welight.fyi`, `https://welight.fyi`)).toBe(`welight.fyi`)
  })

  it(`displayWidth 忽略 OSC 8 转义`, async () => {
    process.env.FORCE_HYPERLINK = `1`
    const { link } = await import('../src/hyperlink')
    const { displayWidth } = await import('../src/welcome')
    const plain = `桌面版：https://welight.fyi`
    expect(displayWidth(link(plain, `https://welight.fyi`))).toBe(displayWidth(plain))
  })
})
