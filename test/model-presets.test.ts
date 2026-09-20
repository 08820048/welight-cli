import { describe, expect, it } from 'vitest'
import { findServiceOption, providerLabel, serviceOptions } from '../src/modelPresets'

describe(`model presets`, () => {
  it(`deepseek 使用官方当前模型名`, () => {
    const deepseek = findServiceOption(`deepseek`)
    expect(deepseek?.models).toContain(`deepseek-flash`)
    expect(deepseek?.models).not.toContain(`deepseek-v4-flash`)
  })

  it(`提供商标签`, () => {
    expect(providerLabel(`openai`)).toBe(`OpenAI`)
    expect(providerLabel(`unknown`)).toBe(`unknown`)
  })

  it(`包含常见提供商与自定义接口`, () => {
    const values = serviceOptions.map(option => option.value)
    expect(values).toContain(`deepseek`)
    expect(values).toContain(`openai`)
    expect(values).toContain(`custom`)
  })
})
