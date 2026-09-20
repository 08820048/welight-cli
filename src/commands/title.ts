import process from 'node:process'
import { Command, Option } from 'clipanion'
import { TITLE_GENERATOR_PROMPT } from '../engine'
import { readInput } from '../io'
import { chatCompletion, parseTitleList } from '../modelClient'

const DEFAULT_COUNT = 5

export class TitleCommand extends Command {
  static paths = [[`title`]]

  static usage = Command.Usage({
    description: `为文章生成候选标题（BYOK 模型）`,
    details: `
      使用与桌面端一致的「爆款标题」提示词，调用你自己配置的 OpenAI 兼容模型生成候选标题。
      需要 WELIGHT_MODEL_API_KEY / WELIGHT_MODEL_BASE_URL / WELIGHT_MODEL，
      或用 --api-key / --base-url / --model 传入。

      可传 Markdown 文件，或用 --topic 直接给一个主题。
    `,
    examples: [
      [`为文章生成标题`, `$0 title post.md`],
      [`按主题生成`, `$0 title --topic "如何用 Markdown 排版公众号" --count 8`],
      [`JSON 输出`, `$0 title post.md --json`],
    ],
  })

  file = Option.String({ required: false })

  topic = Option.String(`--topic`, { description: `直接给定主题，替代文件内容` })

  count = Option.String(`--count`, { description: `生成数量，默认 ${DEFAULT_COUNT}` })

  model = Option.String(`--model`, { description: `模型名（默认读 WELIGHT_MODEL）` })

  baseUrl = Option.String(`--base-url`, { description: `OpenAI 兼容接口地址（默认读 WELIGHT_MODEL_BASE_URL）` })

  apiKey = Option.String(`--api-key`, { description: `模型 API Key（默认读 WELIGHT_MODEL_API_KEY）` })

  json = Option.Boolean(`--json`, false, { description: `以 JSON 输出` })

  async execute(): Promise<number> {
    const apiKey = (this.apiKey ?? process.env.WELIGHT_MODEL_API_KEY ?? ``).trim()
    const baseUrl = (this.baseUrl ?? process.env.WELIGHT_MODEL_BASE_URL ?? ``).trim()
    const model = (this.model ?? process.env.WELIGHT_MODEL ?? ``).trim()

    let content = this.topic?.trim() ?? ``
    if (!content) {
      if (!this.file) {
        this.context.stderr.write(`错误：请提供 Markdown 文件，或使用 --topic 指定主题。\n`)
        return 1
      }
      content = await readInput(this.file)
      if (!content.trim()) {
        this.context.stderr.write(`错误：文件内容为空。\n`)
        return 1
      }
    }

    const countRaw = Number(this.count ?? DEFAULT_COUNT)
    const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.min(Math.floor(countRaw), 20) : DEFAULT_COUNT

    let titles: string[] = []
    try {
      const raw = await chatCompletion({
        baseUrl,
        apiKey,
        model,
        messages: [
          { role: `system`, content: TITLE_GENERATOR_PROMPT },
          {
            role: `user`,
            content: `请根据以下内容创作 ${count} 个候选标题。只输出标题本身，每行一个，不要编号、不要解释、不要其他任何内容。\n\n---\n${content}`,
          },
        ],
      })
      titles = parseTitleList(raw)
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify({ titles, model: model || undefined }, null, 2)}\n`)
    }
    else {
      this.context.stdout.write(`${titles.join(`\n`)}\n`)
    }
    return 0
  }
}
