/**
 * CLI 配置：c12 负责加载 `welight.config.*`，zod 负责校验与默认值。
 * 密钥类配置不落配置文件，只从环境变量读取（见 src/keys.ts）。
 */

import { loadConfig } from 'c12'
import { z } from 'zod'

export const configSchema = z.object({
  theme: z.string().default(`w001`),
  primaryColor: z.string().default(`#4876b8`),
  fontFamily: z
    .string()
    .default(`-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Arial, sans-serif`),
  fontSize: z.string().default(`16px`),
  customCSS: z.string().default(``),
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
