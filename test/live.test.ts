import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveMarkdown } from '../src/live'

const spies: Array<{ mockRestore: () => void }> = []

afterEach(() => {
  while (spies.length > 0)
    spies.pop()?.mockRestore()
})

describe(`LiveMarkdown`, () => {
  it(`输出角色标签与渲染后的 Markdown，并在结束时换行`, () => {
    const chunks: string[] = []
    spies.push(vi.spyOn(process.stdout, `write`).mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk))
      return true
    }))

    const live = new LiveMarkdown(`◆ WelightAI`)
    live.append(`# 标题\n\n正文 **粗体** 与 \`代码\``)
    live.finish()

    const output = chunks.join(``)
    expect(output).toContain(`WelightAI`)
    expect(output).toContain(`标题`)
    expect(output).toContain(`粗体`)
    expect(output).toContain(`代码`)
    expect(output.endsWith(`\n`)).toBe(true)
  })

  it(`重绘时使用光标回退`, () => {
    const chunks: string[] = []
    spies.push(vi.spyOn(process.stdout, `write`).mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk))
      return true
    }))

    const live = new LiveMarkdown()
    live.append(`第一段\n`)
    // 强制一次重绘（绕过节流）
    live.append(`第二段`)
    live.finish()

    expect(chunks.join(``)).toContain(`\u001B[`)
  })
})
