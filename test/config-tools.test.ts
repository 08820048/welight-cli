import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AI_TOOLS } from '../src/ai/tools'
import { configSchema, getConfigValue, readRawConfig, saveConfigValues, setConfigValue, unsetConfigValue } from '../src/config'
import { credentialsFilePath, credentialStatus, loadCredentials, removeCredential, resolveCredentialName, saveCredential } from '../src/credentials'
import { installDom } from '../src/dom'

installDom()

function tool(name: string) {
  const found = AI_TOOLS.find(item => item.name === name)
  if (!found)
    throw new Error(`missing tool ${name}`)
  return found
}

let dir = ``
let prevCwd = ``
let prevHome: string | undefined
const savedKeys: Record<string, string | undefined> = {}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), `wl-cfg-tools-`))
  prevCwd = process.cwd()
  prevHome = process.env.WELIGHT_HOME
  process.env.WELIGHT_HOME = dir
  process.chdir(dir)
  for (const key of [`WELIGHT_ZHUQUE_KEY`, `WELIGHT_MODEL_API_KEY`]) {
    savedKeys[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  process.chdir(prevCwd)
  fs.rmSync(dir, { recursive: true, force: true })
  if (prevHome === undefined)
    delete process.env.WELIGHT_HOME
  else
    process.env.WELIGHT_HOME = prevHome
  for (const [key, value] of Object.entries(savedKeys)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
})

describe(`凭证存储`, () => {
  it(`保存并加载凭据（权限 0600）`, () => {
    saveCredential(`WELIGHT_ZHUQUE_KEY`, `secret-value`)
    const file = credentialsFilePath()
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.readFileSync(file, `utf8`)).toContain(`WELIGHT_ZHUQUE_KEY`)
    if (process.platform !== `win32`)
      expect(fs.statSync(file).mode & 0o777).toBe(0o600)

    delete process.env.WELIGHT_ZHUQUE_KEY
    loadCredentials()
    expect(process.env.WELIGHT_ZHUQUE_KEY).toBe(`secret-value`)
  })

  it(`拒绝未知凭据名`, () => {
    expect(() => saveCredential(`FOO_BAR`, `x`)).toThrow(/不支持的凭据项/)
  })

  it(`状态查询不含值`, () => {
    const status = credentialStatus()
    expect(status.find(item => item.name === `WELIGHT_MODEL_API_KEY`)?.label).toContain(`模型`)
    expect(status.every(item => typeof item.configured === `boolean`)).toBe(true)
  })
})

describe(`saveConfigValues`, () => {
  it(`合并写入并校验`, () => {
    const first = saveConfigValues({ theme: `w011`, model: { model: `deepseek-chat` } }, dir)
    expect(fs.existsSync(first.file)).toBe(true)
    expect(first.config.theme).toBe(`w011`)

    const second = saveConfigValues({ watermark: false, model: { baseUrl: `https://api.deepseek.com/v1` } }, dir)
    expect(second.config.watermark).toBe(false)
    expect(second.config.model).toEqual({ baseUrl: `https://api.deepseek.com/v1`, model: `deepseek-chat` })
  })

  it(`拒绝未知配置键`, () => {
    expect(() => saveConfigValues({ nope: 1 }, dir)).toThrow(/不支持的配置项/)
  })
})

describe(`config 点路径读写`, () => {
  it(`set / get / unset`, () => {
    setConfigValue(`theme`, `w011`, dir)
    setConfigValue(`model.baseUrl`, `https://api.deepseek.com/v1`, dir)
    setConfigValue(`watermark`, `false`, dir)

    const config = configSchema.parse(readRawConfig(dir))
    expect(config.theme).toBe(`w011`)
    expect(config.model.baseUrl).toBe(`https://api.deepseek.com/v1`)
    expect(config.watermark).toBe(false)
    expect(getConfigValue(config, `model.baseUrl`)).toBe(`https://api.deepseek.com/v1`)

    unsetConfigValue(`theme`, dir)
    expect(configSchema.parse(readRawConfig(dir)).theme).toBe(`w001`)
  })

  it(`拒绝未知路径写入`, () => {
    expect(() => setConfigValue(`bogus.x`, `1`, dir)).toThrow(/不支持的配置项/)
    expect(() => unsetConfigValue(`nope`, dir)).toThrow(/不支持的配置项/)
  })
})

describe(`凭据别名与删除`, () => {
  it(`解析别名`, () => {
    expect(resolveCredentialName(`model`)).toBe(`WELIGHT_MODEL_API_KEY`)
    expect(resolveCredentialName(`typesafe`)).toBe(`WELIGHT_TYPESAFE_KEY`)
    expect(resolveCredentialName(`wechat-app-secret`)).toBe(`WELIGHT_WECHAT_APP_SECRET`)
    expect(resolveCredentialName(`WELIGHT_ZHUQUE_KEY`)).toBe(`WELIGHT_ZHUQUE_KEY`)
    expect(resolveCredentialName(`nope`)).toBeNull()
  })

  it(`删除凭据并清除环境变量`, () => {
    saveCredential(`WELIGHT_TYPESAFE_KEY`, `x`)
    expect(process.env.WELIGHT_TYPESAFE_KEY).toBe(`x`)
    removeCredential(`WELIGHT_TYPESAFE_KEY`)
    expect(process.env.WELIGHT_TYPESAFE_KEY).toBeUndefined()
    expect(fs.readFileSync(path.join(dir, `credentials`), `utf8`)).not.toContain(`WELIGHT_TYPESAFE_KEY`)
  })
})

describe(`配置相关 ai 工具`, () => {
  it(`get_config_status 返回现状`, async () => {
    const result = await tool(`get_config_status`).run({}, { content: `` })
    expect(result).toContain(`主题`)
    expect(result).toContain(`公众号 AppID`)
  })

  it(`save_config 写入配置文件`, async () => {
    const result = await tool(`save_config`).run(
      { theme: `w011`, modelModel: `deepseek-chat`, lintFailOn: `low` },
      { content: `` },
    )
    expect(result).toContain(`已写入配置`)
    const config = JSON.parse(fs.readFileSync(path.join(dir, `welight.config.json`), `utf8`))
    expect(config.theme).toBe(`w011`)
    expect(config.model.model).toBe(`deepseek-chat`)
    expect(config.lint.failOn).toBe(`low`)
  })

  it(`store_secret 本地保存且不发送给模型`, async () => {
    const result = await tool(`store_secret`).run(
      { name: `WELIGHT_ZHUQUE_KEY` },
      { content: ``, requestSecret: async () => `secret-value` },
    )
    expect(result).toContain(`已保存`)
    expect(fs.readFileSync(path.join(dir, `credentials`), `utf8`)).toContain(`WELIGHT_ZHUQUE_KEY`)
    expect(process.env.WELIGHT_ZHUQUE_KEY).toBe(`secret-value`)
  })

  it(`store_secret 非交互时降级提示`, async () => {
    const result = await tool(`store_secret`).run({ name: `WELIGHT_MODEL_API_KEY` }, { content: `` })
    expect(result).toContain(`交互`)
  })
})
