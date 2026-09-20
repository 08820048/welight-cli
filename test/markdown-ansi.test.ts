import { describe, expect, it } from 'vitest'
import { markdownToAnsi } from '../src/markdown/ansi'

describe(`markdownToAnsi`, () => {
  it(`渲染标题、强调、代码与列表`, () => {
    const out = markdownToAnsi(`# 大标题\n\n这是 **粗体** 与 \`行内代码\`。\n\n- 项目一\n- 项目二\n\n> 引用`)
    expect(out).toContain(`大标题`)
    expect(out).not.toContain(`#`)
    expect(out).toContain(`粗体`)
    expect(out).toContain(`行内代码`)
    expect(out).toContain(`•`)
    expect(out).toContain(`引用`)
  })

  it(`代码块带边框前缀`, () => {
    const out = markdownToAnsi(`\`\`\`js\nconst a = 1\n\`\`\``)
    expect(out).toContain(`const a = 1`)
    expect(out).toContain(`│`)
  })
})
