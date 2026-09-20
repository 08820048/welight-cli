import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, resolveModelSettings, resolveTypesafeEndpoint } from '../config'
import { TITLE_GENERATOR_PROMPT } from '../engine'
import { readInput } from '../io'
import { chatCompletion, parseTitleList } from '../modelClient'
import { p, presentCommand } from '../present'
import { scoreTitles } from '../titleScore'
import type { TitleScoreReport } from '../titleScore'
import { c, ui } from '../ui'

const DEFAULT_COUNT = 5

interface TitleData {
  titles: string[]
  scoreReport: TitleScoreReport | null
  warned?: string
}

export function registerTitle(program: Command): void {
  program
    .command(`title`)
    .description(`为文章生成候选标题（BYOK 模型，可选 TypeSafe 评分）`)
    .argument(`[file]`, `Markdown 文件路径；也可用 --topic 直接给主题`)
    .option(`--topic <text>`, `直接给定主题，替代文件内容`)
    .option(`--count <n>`, `生成数量，默认 ${DEFAULT_COUNT}`)
    .option(`--model <name>`, `模型名（默认读配置 / WELIGHT_MODEL）`)
    .option(`--base-url <url>`, `OpenAI 兼容接口地址（默认读配置 / WELIGHT_MODEL_BASE_URL）`)
    .option(`--api-key <key>`, `模型 API Key（默认读本地凭据 / WELIGHT_MODEL_API_KEY）`)
    .option(`--json`, `以 JSON 输出`)
    .option(`--score`, `用 TypeSafe 判断层给候选标题打分排序（默认开启）`)
    .option(`--no-score`, `跳过标题评分`)
    .option(`--typesafe-key <key>`, `TypeSafe API Key（默认读本地凭据 / WELIGHT_TYPESAFE_KEY）`)
    .addHelpText(`after`, `\n示例:\n  $ welight title post.md --count 6\n  $ welight title --topic "如何用 Markdown 排版公众号"`)
    .action(async (file: string | undefined, options: {
      topic?: string
      count?: string
      model?: string
      baseUrl?: string
      apiKey?: string
      json?: boolean
      score?: boolean
      typesafeKey?: string
    }) => {
      const { config } = await loadWelightConfig()
      const settings = resolveModelSettings(config, {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
      })

      let content = options.topic?.trim() ?? ``
      if (!content) {
        if (!file) {
          ui.error(`请提供 Markdown 文件，或使用 --topic 指定主题。`)
          process.exitCode = 1
          return
        }
        content = await readInput(file)
        if (!content.trim()) {
          ui.error(`文件内容为空。`)
          process.exitCode = 1
          return
        }
      }

      const countRaw = Number(options.count ?? DEFAULT_COUNT)
      const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.min(Math.floor(countRaw), 20) : DEFAULT_COUNT

      const run = async (): Promise<TitleData> => {
        const raw = await chatCompletion({
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          messages: [
            { role: `system`, content: TITLE_GENERATOR_PROMPT },
            { role: `user`, content: `请根据以下内容创作 ${count} 个候选标题。只输出标题本身，每行一个，不要编号、不要解释、不要其他任何内容。\n\n---\n${content}` },
          ],
        })
        const titles = parseTitleList(raw)

        const scoreEnabled = options.score ?? true
        const typesafeKey = (options.typesafeKey ?? process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim()
        let scoreReport: TitleScoreReport | null = null
        let warned: string | undefined
        if (scoreEnabled && titles.length > 0) {
          if (typesafeKey) {
            scoreReport = await scoreTitles(titles, { apiKey: typesafeKey, endpoint: resolveTypesafeEndpoint(config) })
            if (!scoreReport)
              warned = `判断层评分不可用，已返回未评分候选`
          }
          else {
            warned = `未配置 TypeSafe Key，跳过标题评分`
          }
        }
        return { titles, scoreReport, warned }
      }

      if (options.json) {
        try {
          const data = await run()
          process.stdout.write(`${JSON.stringify({
            titles: data.titles,
            scored: Boolean(data.scoreReport),
            ranking: data.scoreReport?.ranking,
            unscored: data.scoreReport?.unscored,
            top: data.scoreReport?.top,
            judgeModel: data.scoreReport?.model,
            model: settings.model || undefined,
          }, null, 2)}\n`)
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      await presentCommand<TitleData>({
        spinner: `生成标题…`,
        run,
        view: (data) => {
          if (data.warned)
            p.log.warn(data.warned)
          if (data.scoreReport) {
            data.scoreReport.ranking.forEach((entry, index) => {
              process.stdout.write(`  ${c.bold(`${index + 1}.`)} ${c.yellow(`[${entry.score?.toFixed(2)}]`)} ${entry.title}\n`)
            })
            if (data.scoreReport.unscored.length > 0)
              process.stdout.write(`  ${c.dim(`低置信未评分：${data.scoreReport.unscored.map(e => e.title).join(`；`)}`)}\n`)
          }
          else {
            for (const title of data.titles)
              process.stdout.write(`  · ${title}\n`)
          }
        },
        plain: (data) => {
          if (data.warned)
            ui.warn(data.warned)
          if (data.scoreReport) {
            data.scoreReport.ranking.forEach((entry, index) => {
              process.stdout.write(`  ${c.bold(`${index + 1}.`)} ${c.yellow(`[${entry.score?.toFixed(2)}]`)} ${entry.title}\n`)
            })
            if (data.scoreReport.unscored.length > 0)
              process.stdout.write(`  ${c.dim(`低置信未评分：${data.scoreReport.unscored.map(e => e.title).join(`；`)}`)}\n`)
          }
          else {
            for (const title of data.titles)
              process.stdout.write(`  · ${title}\n`)
          }
        },
      })
    })
}
