import process from 'node:process'
import type { Command } from 'commander'
import type { ZhuqueDetectReport } from '../engine'
import { ZHUQUE_LABEL_NAMES } from '../engine'
import { readInput } from '../io'
import { kvLines, note, presentCommand } from '../present'
import { c, printKeyValues, ui } from '../ui'
import { aiRatio, detectAiText } from '../zhuqueApi'

function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 1000) / 10}%`
}

interface DetectData {
  report: ZhuqueDetectReport
  ratio: number
}

export function registerDetect(program: Command): void {
  program
    .command(`detect`)
    .description(`腾讯朱雀 AIGC 检测（自配 EdgeOne Key）`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`--api-key <key>`, `EdgeOne API Key（默认读本地凭据 / WELIGHT_ZHUQUE_KEY）`)
    .option(`--json`, `以 JSON 输出完整报告`)
    .option(`--max-ai <percent>`, `AI + 疑似 AI 占比达到该百分比时退出码为 1`)
    .option(`--timeout <ms>`, `请求超时毫秒数，默认 20000`)
    .addHelpText(`after`, `\nCLI 不做官方代理，必须自配 EdgeOne API Key。\n\n示例:\n  $ welight detect post.md\n  $ welight detect post.md --max-ai 40`)
    .action(async (file: string, options: { apiKey?: string, json?: boolean, maxAi?: string, timeout?: string }) => {
      const apiKey = (options.apiKey ?? process.env.WELIGHT_ZHUQUE_KEY ?? ``).trim()
      if (!apiKey) {
        ui.error(`缺少 EdgeOne API Key。请运行 welight setup，或设置 WELIGHT_ZHUQUE_KEY。`)
        process.exitCode = 1
        return
      }
      const markdown = await readInput(file)
      const timeoutMs = options.timeout ? Number(options.timeout) : undefined
      const run = async (): Promise<DetectData> => {
        const report = await detectAiText(markdown, {
          apiKey,
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
          endpoint: process.env.WELIGHT_ZHUQUE_ENDPOINT,
        })
        return { report, ratio: aiRatio(report) }
      }

      if (options.json) {
        try {
          const data = await run()
          process.stdout.write(`${JSON.stringify({ ...data.report, aiRatio: data.ratio }, null, 2)}\n`)
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      const data = await presentCommand<DetectData>({
        spinner: `检测中…`,
        run,
        view: (result) => {
          const labels = result.report.result.labels_ratio ?? {}
          const segments = result.report.result.segment_labels ?? []
          const lines = kvLines([
            [`送检字符`, `${result.report.detectedChars}${result.report.truncated ? `（已截断）` : ``}`],
            [`人工`, percent(labels[`0`])],
            [`AI 生成`, percent(labels[`1`])],
            [`疑似 AI`, percent(labels[`2`])],
            [`AI + 疑似`, c.bold(percent(result.ratio))],
            [`整体疑似风险`, String(result.report.result.ratio_confidence ?? 0)],
          ])
          note(`朱雀 AIGC 检测`, lines)
          for (const segment of segments.slice(0, 10)) {
            const name = ZHUQUE_LABEL_NAMES[segment.label] ?? segment.label
            process.stdout.write(`  ${c.dim(`[${name} ${percent(segment.conf)}]`)} ${segment.text.replace(/\s+/g, ` `).slice(0, 60)}\n`)
          }
        },
        plain: (result) => {
          const labels = result.report.result.labels_ratio ?? {}
          process.stdout.write(`朱雀 AIGC 检测\n`)
          printKeyValues([
            [`送检字符`, `${result.report.detectedChars}${result.report.truncated ? `（已截断）` : ``}`],
            [`人工`, percent(labels[`0`])],
            [`AI 生成`, percent(labels[`1`])],
            [`疑似 AI`, percent(labels[`2`])],
            [`AI + 疑似`, percent(result.ratio)],
          ])
        },
      })

      const threshold = options.maxAi ? Number(options.maxAi) : undefined
      if (data && threshold !== undefined && Number.isFinite(threshold) && data.ratio * 100 >= threshold)
        process.exitCode = 1
    })
}
