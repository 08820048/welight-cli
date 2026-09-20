import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, resolveModelSettings, resolveTypesafeEndpoint } from '../config'
import type { LayoutTierSetting } from '../engine'
import { LAYOUT_TIER_SETTINGS } from '../engine'
import { readInput } from '../io'
import type { LayoutResult } from '../layout'
import { runLayout, TIER_DESCRIPTIONS, TIER_LABELS } from '../layout'
import { markdownToAnsi } from '../markdown/ansi'
import { p, presentCommand } from '../present'
import { askSelect, isInteractive } from '../prompt'
import { ui } from '../ui'

interface LayoutCliOptions {
  tier?: string
  out?: string
  inPlace?: boolean
  json?: boolean
  model?: string
  baseUrl?: string
  apiKey?: string
  typesafeKey?: string
}

interface WrittenResult {
  path: string
  tier: LayoutResult['tier']
  recommended: boolean
  bytes: number
}

function isTier(value: string): value is LayoutTierSetting {
  return (LAYOUT_TIER_SETTINGS as string[]).includes(value)
}

export function registerLayout(program: Command): void {
  program
    .command(`layout`)
    .description(`一键排版：按档位用 AI 重排文章结构（BYOK 模型）`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`-t, --tier <tier>`, `排版档位：auto | minimal | standard | rich（默认 minimal）`)
    .option(`-o, --out <path>`, `输出文件路径`)
    .option(`--in-place`, `直接覆盖源文件`)
    .option(`--json`, `以 JSON 输出`)
    .option(`--model <name>`, `模型名（默认读配置 / WELIGHT_MODEL）`)
    .option(`--base-url <url>`, `OpenAI 兼容接口地址（默认读配置 / WELIGHT_MODEL_BASE_URL）`)
    .option(`--api-key <key>`, `模型 API Key（默认读本地凭据 / WELIGHT_MODEL_API_KEY）`)
    .option(`--typesafe-key <key>`, `auto 档推荐使用的 TypeSafe Key（默认读本地凭据）`)
    .addHelpText(`after`, `\n一键排版会用 AI 重新组织标题层级、强调、列表等结构，保留原文事实与代码。\n\n示例:\n  $ welight layout post.md --tier minimal --in-place\n  $ welight layout post.md --tier auto --out post-formatted.md`)
    .action(async (file: string, options: LayoutCliOptions) => {
      const { config } = await loadWelightConfig()
      const settings = resolveModelSettings(config, {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
      })

      const missing: string[] = []
      if (!settings.baseUrl)
        missing.push(`模型接口（--base-url 或 model.baseUrl）`)
      if (!settings.model)
        missing.push(`模型名（--model 或 model.model）`)
      if (!settings.apiKey)
        missing.push(`模型密钥（welight auth set model）`)
      if (missing.length > 0) {
        ui.error(`模型配置不完整，缺少：${missing.join(`、`)}。\n运行 welight model 或 welight setup 补全。`)
        process.exitCode = 1
        return
      }

      if (options.tier && !isTier(options.tier)) {
        ui.error(`未知档位：${options.tier}。可用：${LAYOUT_TIER_SETTINGS.join(` / `)}`)
        process.exitCode = 1
        return
      }

      let tier: LayoutTierSetting = options.tier && isTier(options.tier) ? options.tier : `minimal`
      if (!options.tier && !options.json && !options.out && !options.inPlace && isInteractive()) {
        const picked = await askSelect(
          `选择排版档位`,
          LAYOUT_TIER_SETTINGS.map(value => ({ value, label: value, hint: TIER_DESCRIPTIONS[value] })),
        )
        if (picked && isTier(picked))
          tier = picked
      }

      const markdown = await readInput(file)
      if (!markdown.trim()) {
        ui.error(`文件内容为空。`)
        process.exitCode = 1
        return
      }

      if (options.inPlace && file === `-`) {
        ui.error(`--in-place 需要指定文件，不能用于 stdin。`)
        process.exitCode = 1
        return
      }

      const typesafeKey = (options.typesafeKey ?? process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim()
      const run = (): Promise<LayoutResult> => runLayout(markdown, {
        tier,
        model: settings,
        typesafe: { apiKey: typesafeKey, endpoint: resolveTypesafeEndpoint(config) },
      })

      if (options.json) {
        try {
          process.stdout.write(`${JSON.stringify(await run(), null, 2)}\n`)
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      const outPath = options.inPlace
        ? path.resolve(file)
        : options.out ? path.resolve(options.out) : null

      if (outPath) {
        await presentCommand<WrittenResult>({
          spinner: `排版中…`,
          run: async () => {
            const result = await run()
            const content = result.markdown.endsWith(`\n`) ? result.markdown : `${result.markdown}\n`
            await fs.writeFile(outPath, content, `utf8`)
            return { path: outPath, tier: result.tier, recommended: result.recommended, bytes: Buffer.byteLength(content, `utf8`) }
          },
          view: (data) => {
            p.log.success(`已排版并写入 ${data.path}`)
            p.log.info(`档位：${TIER_LABELS[data.tier]}${data.recommended ? `（AI 推荐）` : ``} · ${data.bytes} 字节`)
          },
          plain: (data) => {
            ui.success(`已排版并写入 ${data.path}`)
            process.stdout.write(`${TIER_LABELS[data.tier]}${data.recommended ? `（AI 推荐）` : ``}\n`)
          },
        })
        return
      }

      await presentCommand<LayoutResult>({
        spinner: `排版中…`,
        run,
        view: (data) => {
          p.log.step(`一键排版结果 · 档位：${TIER_LABELS[data.tier]}${data.recommended ? `（AI 推荐）` : ``}`)
          process.stdout.write(`${markdownToAnsi(data.markdown)}\n`)
        },
        plain: (data) => {
          process.stdout.write(data.markdown.endsWith(`\n`) ? data.markdown : `${data.markdown}\n`)
        },
      })
    })
}
