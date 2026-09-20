/**
 * 本地凭据存储（BYOK）。
 *
 * 密钥不写入 welight.config.json，也不经过模型上下文；只保存在
 * `~/.config/welight/credentials`（可用 WELIGHT_HOME 覆盖），权限 0600，
 * 启动时加载进 process.env 供各命令使用。
 *
 * 非敏感项（主题、模型接口等）仍写入 welight.config.json。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export const CREDENTIAL_SPECS = {
  WELIGHT_MODEL_API_KEY: `模型 API Key`,
  WELIGHT_TYPESAFE_KEY: `TypeSafe 判断层 Key`,
  WELIGHT_ZHUQUE_KEY: `朱雀 EdgeOne Key`,
  WELIGHT_WECHAT_APP_ID: `公众号 AppID`,
  WELIGHT_WECHAT_APP_SECRET: `公众号 AppSecret`,
} as const

export type CredentialName = keyof typeof CREDENTIAL_SPECS

export function isCredentialName(name: string): name is CredentialName {
  return Object.prototype.hasOwnProperty.call(CREDENTIAL_SPECS, name)
}

/** 简写别名 → 环境变量名 */
export const CREDENTIAL_ALIASES: Record<string, CredentialName> = {
  model: `WELIGHT_MODEL_API_KEY`,
  typesafe: `WELIGHT_TYPESAFE_KEY`,
  zhuque: `WELIGHT_ZHUQUE_KEY`,
  'wechat-app-id': `WELIGHT_WECHAT_APP_ID`,
  'wechat-app-secret': `WELIGHT_WECHAT_APP_SECRET`,
}

/** 把用户输入（全名或别名）解析为凭据名 */
export function resolveCredentialName(name: string): CredentialName | null {
  const trimmed = name.trim()
  if (isCredentialName(trimmed))
    return trimmed
  return CREDENTIAL_ALIASES[trimmed.toLowerCase()] ?? null
}

export function credentialsFilePath(): string {
  const home = (process.env.WELIGHT_HOME ?? ``).trim() || path.join(os.homedir(), `.config`, `welight`)
  return path.join(home, `credentials`)
}

function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(`#`))
      continue
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed)
    if (!match)
      continue
    const [, key, rawValue] = match
    let value = rawValue
    if (value.startsWith(`"`) && value.endsWith(`"`)) {
      try {
        value = JSON.parse(value) as string
      }
      catch {
        value = value.slice(1, -1)
      }
    }
    result[key] = value
  }
  return result
}

/** 启动时加载本地凭据（不覆盖已存在的环境变量） */
export function loadCredentials(): void {
  try {
    const text = fs.readFileSync(credentialsFilePath(), `utf8`)
    const map = parseEnvFile(text)
    for (const [key, value] of Object.entries(map)) {
      if (isCredentialName(key) && !process.env[key])
        process.env[key] = value
    }
  }
  catch {
    // 文件不存在时忽略
  }
}

/** 保存单个凭据，权限 0600，并即时写入 process.env */
export function saveCredential(name: string, value: string): void {
  if (!isCredentialName(name))
    throw new Error(`不支持的凭据项：${name}`)
  const file = credentialsFilePath()
  let map: Record<string, string> = {}
  try {
    map = parseEnvFile(fs.readFileSync(file, `utf8`))
  }
  catch {
    map = {}
  }
  map[name] = value
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const content = `${Object.entries(map).map(([key, val]) => `${key}=${JSON.stringify(val)}`).join(`\n`)}\n`
  fs.writeFileSync(file, content, { mode: 0o600 })
  try {
    fs.chmodSync(file, 0o600)
  }
  catch {
    // 某些文件系统不支持 chmod，忽略
  }
  process.env[name] = value
}

/** 删除单个凭据 */
export function removeCredential(name: string): void {
  if (!isCredentialName(name))
    throw new Error(`不支持的凭据项：${name}`)
  const file = credentialsFilePath()
  let map: Record<string, string> = {}
  try {
    map = parseEnvFile(fs.readFileSync(file, `utf8`))
  }
  catch {
    map = {}
  }
  delete map[name]
  const entries = Object.entries(map)
  const content = entries.length > 0
    ? `${entries.map(([key, val]) => `${key}=${JSON.stringify(val)}`).join(`\n`)}\n`
    : ``
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, { mode: 0o600 })
  delete process.env[name]
}

/** 各凭据是否已配置（不含值） */
export function credentialStatus(): Array<{ name: CredentialName, label: string, configured: boolean }> {
  return (Object.entries(CREDENTIAL_SPECS) as Array<[CredentialName, string]>).map(([name, label]) => ({
    name,
    label,
    configured: Boolean(process.env[name]),
  }))
}
