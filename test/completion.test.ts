import { describe, expect, it } from 'vitest'
import { createCli } from '../src/cli'
import { completeSuggestions } from '../src/completion'

const program = createCli()

describe(`shell 补全`, () => {
  it(`补全子命令`, () => {
    expect(completeSuggestions(program, [`re`])).toContain(`render`)
  })

  it(`补全选项`, () => {
    expect(completeSuggestions(program, [`render`, `--th`])).toContain(`--theme`)
  })

  it(`补全主题取值`, () => {
    const suggestions = completeSuggestions(program, [`render`, `--theme`, `w01`])
    expect(suggestions).toContain(`w011`)
    expect(suggestions.every(value => value.startsWith(`w01`))).toBe(true)
  })

  it(`补全提供商`, () => {
    expect(completeSuggestions(program, [`model`, `--provider`, `d`])).toContain(`deepseek`)
  })

  it(`补全排版档位`, () => {
    expect(completeSuggestions(program, [`layout`, `--tier`, ``])).toEqual([`auto`, `minimal`, `standard`, `rich`])
  })

  it(`不重复建议已输入完整的命令`, () => {
    expect(completeSuggestions(program, [`render`])).not.toContain(`render`)
  })

  it(`隐藏命令不出现在候选`, () => {
    expect(completeSuggestions(program, [``])).not.toContain(`__complete`)
  })
})
