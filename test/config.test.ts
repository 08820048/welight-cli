import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  configSchema,
  resolveCodeTheme,
  resolveFailOn,
  resolveModelSettings,
  resolveProxy,
  resolveWatermark,
} from '../src/config'

const ENV_KEYS = [
  `WELIGHT_MODEL_API_KEY`,
  `WELIGHT_MODEL_BASE_URL`,
  `WELIGHT_MODEL`,
  `WELIGHT_TYPESAFE_ENDPOINT`,
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
})

describe(`config`, () => {
  it(`空配置得到完整默认值`, () => {
    const config = configSchema.parse({})
    expect(config.theme).toBe(`w001`)
    expect(config.codeTheme).toBe(`github-dark`)
    expect(config.watermark).toBe(true)
    expect(config.proxy).toBe(``)
    expect(config.lint.failOn).toBe(`high`)
    expect(config.model).toEqual({ provider: ``, baseUrl: ``, model: `` })
    expect(config.typesafe.endpoint).toBe(``)
  })

  it(`嵌套配置覆盖默认值`, () => {
    const config = configSchema.parse({
      theme: `w011`,
      lint: { failOn: `low` },
      model: { model: `deepseek-chat` },
    })
    expect(config.theme).toBe(`w011`)
    expect(config.lint.failOn).toBe(`low`)
    expect(config.model.model).toBe(`deepseek-chat`)
    expect(config.model.baseUrl).toBe(``)
  })

  it(`模型优先级：flag > env > 配置`, () => {
    const config = configSchema.parse({ model: { baseUrl: `https://cfg`, model: `cfg-model` } })
    expect(resolveModelSettings(config, { baseUrl: `https://flag`, model: `flag-model`, apiKey: `k` })).toEqual({
      baseUrl: `https://flag`,
      model: `flag-model`,
      apiKey: `k`,
    })
    expect(resolveModelSettings(config, { apiKey: `k` })).toEqual({
      baseUrl: `https://cfg`,
      model: `cfg-model`,
      apiKey: `k`,
    })

    process.env.WELIGHT_MODEL_BASE_URL = `https://env`
    process.env.WELIGHT_MODEL = `env-model`
    expect(resolveModelSettings(config, { apiKey: `k` })).toEqual({
      baseUrl: `https://env`,
      model: `env-model`,
      apiKey: `k`,
    })
  })

  it(`其余解析器：水印/代码主题/代理/lint 阈值`, () => {
    const config = configSchema.parse({
      watermark: false,
      codeTheme: `atom-one-light`,
      proxy: `https://proxy.example.com`,
      lint: { failOn: `medium` },
    })
    expect(resolveWatermark(config, undefined)).toBe(false)
    expect(resolveWatermark(config, true)).toBe(true)
    expect(resolveCodeTheme(config)).toBe(`atom-one-light`)
    expect(resolveCodeTheme(config, `none`)).toBe(`none`)
    expect(resolveProxy(config)).toBe(`https://proxy.example.com`)
    expect(resolveFailOn(config)).toBe(`medium`)
    expect(resolveFailOn(config, `low`)).toBe(`low`)
    expect(resolveFailOn(config, `bogus`)).toBe(`high`)
  })
})
