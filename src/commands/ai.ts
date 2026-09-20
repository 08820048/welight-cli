import fs from 'node:fs/promises'
import process from 'node:process'
import { Command, Option } from 'clipanion'
import { runAgent } from '../ai/agent'
import { readInput } from '../io'

export class AiCommand extends Command {
  static paths = [[`ai`]]

  static usage = Command.Usage({
    description: `Welight AI：带文章上下文的写作助手（BYOK 模型 + CLI 工具）`,
    details: `
      把指令与文章上下文交给你自己配置的 OpenAI 兼容模型，模型可按需调用 CLI 工具
      （公众号规则扫描、朱雀 AIGC 检测）。

      需要 WELIGHT_MODEL_API_KEY / WELIGHT_MODEL_BASE_URL / WELIGHT_MODEL，
      或用 --api-key / --base-url / --model 传入。朱雀工具额外需要 WELIGHT_ZHUQUE_KEY。
    `,
    examples: [
      [`润色文章`, `$0 ai "帮我润色这篇文章，保持原意" --file post.md`],
      [`检查风险`, `$0 ai "这篇文章有没有平台规则风险？" --file post.md`],
      [`结果写回文件`, `$0 ai "把标题改得更有吸引力" --file post.md --out revised.md`],
    ],
  })

  prompt = Option.String({ required: true })

  file = Option.String(`--file,-f`, { description: `文章文件路径（作为上下文）` })

  out = Option.String(`--out,-o`, { description: `把结果写入文件，缺省输出到 stdout` })

  model = Option.String(`--model`, { description: `模型名（默认读 WELIGHT_MODEL）` })

  baseUrl = Option.String(`--base-url`, { description: `OpenAI 兼容接口地址（默认读 WELIGHT_MODEL_BASE_URL）` })

  apiKey = Option.String(`--api-key`, { description: `模型 API Key（默认读 WELIGHT_MODEL_API_KEY）` })

  maxSteps = Option.String(`--max-steps`, { description: `最大工具调用步数，默认 6` })

  stream = Option.Boolean(`--stream`, true, { description: `流式输出（--json / --out 时自动关闭）` })

  json = Option.Boolean(`--json`, false, { description: `以 JSON 输出` })

  async execute(): Promise<number> {
    const apiKey = (this.apiKey ?? process.env.WELIGHT_MODEL_API_KEY ?? ``).trim()
    const baseUrl = (this.baseUrl ?? process.env.WELIGHT_MODEL_BASE_URL ?? ``).trim()
    const model = (this.model ?? process.env.WELIGHT_MODEL ?? ``).trim()

    const content = this.file ? await readInput(this.file) : ``
    const stepsRaw = Number(this.maxSteps ?? 6)
    const maxSteps = Number.isFinite(stepsRaw) && stepsRaw > 0 ? Math.min(Math.floor(stepsRaw), 20) : 6

    let result: string
    let streamed = false
    const shouldStream = this.stream && !this.out && !this.json
    try {
      result = await runAgent({
        prompt: this.prompt,
        content,
        baseUrl,
        apiKey,
        model,
        maxSteps,
        onEvent: message => this.context.stderr.write(`· ${message}\n`),
        onDelta: shouldStream
          ? (text) => {
              streamed = true
              this.context.stdout.write(text)
            }
          : undefined,
      })
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    if (shouldStream) {
      if (streamed)
        this.context.stdout.write(`\n`)
      else if (result)
        this.context.stdout.write(result.endsWith(`\n`) ? result : `${result}\n`)
      return 0
    }

    if (this.out) {
      await fs.writeFile(this.out, result.endsWith(`\n`) ? result : `${result}\n`, `utf8`)
      this.context.stdout.write(`已写入 ${this.out}\n`)
      return 0
    }

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify({ result, model: model || undefined }, null, 2)}\n`)
      return 0
    }

    this.context.stdout.write(result.endsWith(`\n`) ? result : `${result}\n`)
    return 0
  }
}
