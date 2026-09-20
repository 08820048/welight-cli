/**
 * CLI 配置：c12 负责加载 `welight.config.*`，zod 负责校验与默认值。
 *
 * 优先级：命令行参数 > 环境变量 > 配置文件 > 内置默认值。
 * 密钥类配置不落配置文件，只从环境变量 / 参数读取（见 resolveModelSettings）。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { loadConfig } from 'c12'
import { z } from 'zod'

export const lintFailOnValues = [`none`, `low`, `medium`, `high`] as const
export type LintFailOn = (typeof lintFailOnValues)[number]

const lintSchema = z.object({
  /** lint 命中达到该级别时退出码为 1 */
  failOn: z.enum(lintFailOnValues).default(`high`),
})

const modelSchema = z.object({
  /** OpenAI 兼容接口地址（密钥不在此配置） */
  baseUrl: z.string().default(``),
  /** 模型名 */
  model: z.string().default(``),
})

const typesafeSchema = z.object({
  /** 可选：覆盖 TypeSafe 上游地址 */
  endpoint: z.string().default(``),
})

export const configSchema = z.object({
  theme: z.string().default(`w001`),
  primaryColor: z.string().default(`#4876b8`),
  fontFamily: z
    .string()
    .default(`-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Arial, sans-serif`),
  fontSize: z.string().default(`16px`),
  customCSS: z.string().default(``),
  /** highlight.js 代码高亮主题，none 关闭 */
  codeTheme: z.string().default(`github-dark`),
  /** 发布到公众号时是否追加文末水印 */
  watermark: z.boolean().default(true),
  /** 自建微信 API 反向代理 origin，留空则直连 */
  proxy: z.string().default(``),
  lint: lintSchema.default({ failOn: `high` }),
  model: modelSchema.default({ baseUrl: ``, model: `` }),
  typesafe: typesafeSchema.default({ endpoint: `` }),
})

export type WelightConfig = z.infer<typeof configSchema>

export const DEFAULT_CONFIG: WelightConfig = configSchema.parse({})

export interface LoadedConfig {
  config: WelightConfig
  configFile?: string
}

export async function loadWelightConfig(cwd: string = process.cwd()): Promise<LoadedConfig> {
  const { config, configFile } = await loadConfig<Partial<WelightConfig>>({
    name: `welight`,
    cwd,
    dotenv: false,
  })
  const hasConfigFile = config !== undefined && Object.keys(config).length > 0
  return {
    config: configSchema.parse({ ...config }),
    configFile: hasConfigFile ? configFile || undefined : undefined,
  }
}

export interface ModelFlags {
  model?: string
  baseUrl?: string
  apiKey?: string
}

export interface ResolvedModelSettings {
  baseUrl: string
  model: string
  apiKey: string
}

/** 模型设置：flag > env > 配置文件（密钥只取 flag/env） */
export function resolveModelSettings(config: WelightConfig, flags: ModelFlags = {}): ResolvedModelSettings {
  return {
    baseUrl: (flags.baseUrl ?? process.env.WELIGHT_MODEL_BASE_URL ?? config.model.baseUrl ?? ``).trim(),
    model: (flags.model ?? process.env.WELIGHT_MODEL ?? config.model.model ?? ``).trim(),
    apiKey: (flags.apiKey ?? process.env.WELIGHT_MODEL_API_KEY ?? ``).trim(),
  }
}

/** 代码高亮主题：flag > 配置文件 > 默认 */
export function resolveCodeTheme(config: WelightConfig, flag?: string): string {
  return (flag ?? config.codeTheme ?? `github-dark`).trim() || `github-dark`
}

/** 水印开关：flag（显式传入时）> 配置文件 > 默认开启 */
export function resolveWatermark(config: WelightConfig, flag?: boolean): boolean {
  return flag ?? config.watermark
}

/** 微信代理：flag > 配置文件（留空直连） */
export function resolveProxy(config: WelightConfig, flag?: string): string {
  return (flag ?? config.proxy ?? ``).trim()
}

/** lint 失败阈值：flag > 配置文件 > 默认 high */
export function resolveFailOn(config: WelightConfig, flag?: string): LintFailOn {
  const value = (flag ?? config.lint.failOn ?? `high`).trim()
  return (lintFailOnValues as readonly string[]).includes(value) ? (value as LintFailOn) : `high`
}

/** TypeSafe 上游地址：env > 配置文件 > 默认 */
export function resolveTypesafeEndpoint(config: WelightConfig): string {
  return (process.env.WELIGHT_TYPESAFE_ENDPOINT ?? config.typesafe.endpoint ?? ``).trim()
}

/** 允许写入 welight.config.json 的顶层键（密钥不在其中） */
export const SAVEABLE_CONFIG_KEYS = [
  `theme`,
  `primaryColor`,
  `fontFamily`,
  `fontSize`,
  `customCSS`,
  `codeTheme`,
  `watermark`,
  `proxy`,
  `lint`,
  `model`,
  `typesafe`,
] as const

/**
 * 合并写入 welight.config.json（不存在则创建）。
 * 嵌套对象做浅合并，未知键拒绝，写入前经 schema 校验。
 */
export function saveConfigValues(
  patch: Record<string, unknown>,
  cwd: string = process.cwd(),
): { file: string, config: WelightConfig } {
  const file = path.join(cwd, `welight.config.json`)
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(fs.readFileSync(file, `utf8`)) as Record<string, unknown>
  }
  catch {
    existing = {}
  }

  const merged: Record<string, unknown> = { ...existing }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined)
      continue
    if (!(SAVEABLE_CONFIG_KEYS as readonly string[]).includes(key))
      throw new Error(`不支持的配置项：${key}`)
    if (value && typeof value === `object` && !Array.isArray(value)) {
      const current = merged[key]
      merged[key] = {
        ...(current && typeof current === `object` && !Array.isArray(current) ? current as object : {}),
        ...(value as object),
      }
    }
    else {
      merged[key] = value
    }
  }

  const config = configSchema.parse(merged)
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, `utf8`)
  return { file, config }
}
