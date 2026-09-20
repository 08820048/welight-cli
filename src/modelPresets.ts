/**
 * CLI 侧的模型提供商预设。
 *
 * 主体从 GUI 同步（src/engine/shared/ai-service-options），这里只做「校正覆盖」：
 * 当 GUI 内置的模型名滞后于官方 API 时，在 CLI 侧覆盖，避免修改 GUI。
 * 覆盖项应与官方文档核对后更新。
 */

import type { ServiceOption } from './engine/shared/types'
import { serviceOptions as sharedServiceOptions } from './engine'

/**
 * 各提供商的模型名覆盖。
 * 依据官方文档核对（最近核对：DeepSeek Models & Pricing）：
 * - deepseek：旧名 deepseek-v4-flash 已退役，新名 deepseek-flash。
 */
const MODEL_OVERRIDES: Record<string, string[]> = {
  deepseek: [`deepseek-flash`, `deepseek-v4-pro`],
}

export const serviceOptions: ServiceOption[] = sharedServiceOptions.map((option) => {
  const override = MODEL_OVERRIDES[option.value]
  return override ? { ...option, models: override } : option
})

export function findServiceOption(provider: string): ServiceOption | undefined {
  return serviceOptions.find(option => option.value === provider)
}

export function providerLabel(provider: string): string {
  return findServiceOption(provider)?.label ?? provider
}
