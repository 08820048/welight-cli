import process from 'node:process'
import { Command, Option } from 'clipanion'
import { ZHUQUE_LABEL_NAMES } from '../engine'
import { readInput } from '../io'
import { aiRatio, detectAiText } from '../zhuqueApi'

function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 1000) / 10}%`
}

export class DetectCommand extends Command {
  static paths = [[`detect`]]

  static usage = Command.Usage({
    description: `腾讯朱雀 AIGC 检测（自配 EdgeOne API Key）`,
    details: `
      把文章送检腾讯朱雀 AIGC 检测模型，输出人工 / AI 生成 / 疑似 AI 占比与逐段判定。
      CLI 不做官方代理，必须自配 EdgeOne API Key（环境变量 WELIGHT_ZHUQUE_KEY 或 --api-key）。
      文件参数传 "-" 时从 stdin 读取。
    `,
    examples: [
      [`检测文章`, `WELIGHT_ZHUQUE_KEY=xxx $0 detect post.md`],
      [`JSON 输出`, `$0 detect post.md --json`],
      [`AI 占比超 40% 时退出码为 1`, `$0 detect post.md --max-ai 40`],
    ],
  })

  file = Option.String({ required: true })

  apiKey = Option.String(`--api-key`, { description: `EdgeOne API Key（默认读 WELIGHT_ZHUQUE_KEY）` })

  json = Option.Boolean(`--json`, false, { description: `以 JSON 输出完整报告` })

  maxAi = Option.String(`--max-ai`, { description: `AI + 疑似 AI 占比达到该百分比时退出码为 1` })

  timeout = Option.String(`--timeout`, { description: `请求超时毫秒数，默认 20000` })

  async execute(): Promise<number> {
    const apiKey = (this.apiKey ?? process.env.WELIGHT_ZHUQUE_KEY ?? ``).trim()
    if (!apiKey) {
      this.context.stderr.write(
        `错误：缺少 EdgeOne API Key。请设置环境变量 WELIGHT_ZHUQUE_KEY，或使用 --api-key。\n`,
      )
      return 1
    }

    const markdown = await readInput(this.file)
    const timeoutMs = this.timeout ? Number(this.timeout) : undefined

    let report
    try {
      report = await detectAiText(markdown, {
        apiKey,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
        endpoint: process.env.WELIGHT_ZHUQUE_ENDPOINT,
      })
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    const ratio = aiRatio(report)

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify({ ...report, aiRatio: ratio }, null, 2)}\n`)
    }
    else {
      const labels = report.result.labels_ratio ?? {}
      const lines: string[] = []
      lines.push(`朱雀 AIGC 检测`)
      lines.push(`送检字符：${report.detectedChars}${report.truncated ? `（已截断）` : ``}`)
      lines.push(`人工 ${percent(labels[`0`])}   AI 生成 ${percent(labels[`1`])}   疑似 AI ${percent(labels[`2`])}`)
      lines.push(`AI + 疑似合计：${percent(ratio)}`)
      lines.push(`整体疑似风险：${report.result.ratio_confidence ?? 0}`)
      lines.push(``)

      const segments = report.result.segment_labels ?? []
      if (segments.length > 0) {
        lines.push(`分段判定（${segments.length} 段，最多展示 10 段）：`)
        for (const segment of segments.slice(0, 10)) {
          const name = ZHUQUE_LABEL_NAMES[segment.label] ?? segment.label
          const text = segment.text.replace(/\s+/g, ` `).slice(0, 60)
          lines.push(`  [${name} ${percent(segment.conf)}] ${text}`)
        }
      }
      this.context.stdout.write(`${lines.join(`\n`)}\n`)
    }

    if (this.maxAi) {
      const threshold = Number(this.maxAi)
      if (Number.isFinite(threshold) && ratio * 100 >= threshold)
        return 1
    }
    return 0
  }
}
