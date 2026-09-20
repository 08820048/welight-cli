import fs from 'node:fs/promises'
import process from 'node:process'
import { Command, Option } from 'clipanion'
import { AgentSession, runAgent } from '../ai/agent'
import { loadWelightConfig, resolveModelSettings } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { isInteractive, promptSecret, promptText } from '../prompt'

export class AiCommand extends Command {
  static paths = [[`ai`]]

  static usage = Command.Usage({
    description: `Welight AI：写作助手 + 配置助手（BYOK 模型 + CLI 工具）`,
    details: `
      把指令与文章上下文交给你自己配置的 OpenAI 兼容模型，模型可按需调用 CLI 工具
      （规则扫描、朱雀检测、主题渲染、标题评分，以及读写配置）。

      加 --chat 进入多轮对话：可以用自然语言让助手帮你配置主题、模型接口、朱雀、
      TypeSafe、公众号等。密钥由本地安全输入，不会发送给模型。

      需要 WELIGHT_MODEL_API_KEY / WELIGHT_MODEL_BASE_URL / WELIGHT_MODEL，
      或用 --api-key / --base-url / --model 传入。
    `,
    examples: [
      [`润色文章`, `$0 ai "帮我润色这篇文章，保持原意" --file post.md`],
      [`多轮对话 / 配置助手`, `$0 ai --chat`],
      [`检查风险`, `$0 ai "这篇文章有没有平台规则风险？" --file post.md`],
    ],
  })

  prompt = Option.String({ required: false })

  chat = Option.Boolean(`--chat`, false, { description: `进入多轮对话（配置助手 / 连续创作）` })

  file = Option.String(`--file,-f`, { description: `文章文件路径（作为上下文）` })

  out = Option.String(`--out,-o`, { description: `把结果写入文件，缺省输出到 stdout` })

  model = Option.String(`--model`, { description: `模型名（默认读配置 / WELIGHT_MODEL）` })

  baseUrl = Option.String(`--base-url`, { description: `OpenAI 兼容接口地址（默认读配置 / WELIGHT_MODEL_BASE_URL）` })

  apiKey = Option.String(`--api-key`, { description: `模型 API Key（默认读本地凭据 / WELIGHT_MODEL_API_KEY）` })

  maxSteps = Option.String(`--max-steps`, { description: `最大工具调用步数，默认 6` })

  stream = Option.Boolean(`--stream`, { description: `流式输出（默认开启；--json / --out 时自动关闭）` })

  json = Option.Boolean(`--json`, false, { description: `以 JSON 输出` })

  private buildSecretRequester() {
    if (!isInteractive())
      return undefined
    return async (_name: string, label: string): Promise<string | null> => {
      this.context.stderr.write(`\n需要配置「${label}」（输入不回显，也不会发送给模型）\n`)
      try {
        return await promptSecret(`${label}: `)
      }
      catch {
        return null
      }
    }
  }

  async execute(): Promise<number> {
    installDom()

    const { config } = await loadWelightConfig()
    const { apiKey, baseUrl, model } = resolveModelSettings(config, {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
    })
    const stepsRaw = Number(this.maxSteps ?? 6)
    const maxSteps = Number.isFinite(stepsRaw) && stepsRaw > 0 ? Math.min(Math.floor(stepsRaw), 20) : 6

    if (this.chat)
      return this.runChat({ apiKey, baseUrl, model, maxSteps })

    if (!this.prompt) {
      this.context.stderr.write(`错误：请提供指令，或使用 --chat 进入对话模式。\n`)
      return 1
    }

    const content = this.file ? await readInput(this.file) : ``
    const shouldStream = (this.stream ?? true) && !this.out && !this.json

    let result: string
    let streamed = false
    try {
      result = await runAgent({
        prompt: this.prompt,
        content,
        baseUrl,
        apiKey,
        model,
        maxSteps,
        onEvent: message => this.context.stderr.write(`· ${message}\n`),
        requestSecret: this.buildSecretRequester(),
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

  private async runChat(settings: { apiKey: string, baseUrl: string, model: string, maxSteps: number }): Promise<number> {
    if (!isInteractive()) {
      this.context.stderr.write(`错误：--chat 需要在交互式终端中运行。\n`)
      return 1
    }
    if (!settings.apiKey || !settings.baseUrl || !settings.model) {
      this.context.stderr.write(
        `错误：对话模式需要模型配置。请先设置 WELIGHT_MODEL_API_KEY，并配置 WELIGHT_MODEL_BASE_URL / WELIGHT_MODEL（或配置文件 model.baseUrl / model.model）。\n`,
      )
      return 1
    }

    const session = new AgentSession({
      content: this.file ? await readInput(this.file) : ``,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      maxSteps: settings.maxSteps,
      onEvent: message => this.context.stderr.write(`· ${message}\n`),
      requestSecret: this.buildSecretRequester(),
    })

    this.context.stdout.write(`Welight AI 助手（配置 / 写作）。输入 exit 退出。\n`)

    while (true) {
      let input: string
      try {
        input = await promptText(`\n你 > `)
      }
      catch {
        break
      }
      if (!input || [`exit`, `quit`, `:q`].includes(input.toLowerCase()))
        break

      if (this.file)
        session.setContent(await readInput(this.file))

      this.context.stdout.write(`AI > `)
      let streamed = false
      try {
        await session.send(input, (text) => {
          streamed = true
          this.context.stdout.write(text)
        })
      }
      catch (error) {
        this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      }
      this.context.stdout.write(streamed ? `\n` : `\n`)
    }

    return 0
  }
}

export class SetupCommand extends AiCommand {
  static paths = [[`setup`]]

  static usage = Command.Usage({
    description: `配置助手：通过对话完成 model / 朱雀 / TypeSafe / 公众号等配置`,
    details: `
      等价于 welight ai --chat，但以配置为主要目标。
      非敏感项写入 welight.config.json；密钥由本地安全输入，保存到本地凭据文件，
      不会发送给模型。
    `,
    examples: [[`开始配置`, `$0 setup`]],
  })

  async execute(): Promise<number> {
    this.chat = true
    return super.execute()
  }
}
