import fs from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import type { Command } from 'commander'
import { AgentSession, runAgent } from '../ai/agent'
import { loadWelightConfig, resolveModelSettings } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { isInteractive, promptInput, promptSecret } from '../prompt'
import { c, ui } from '../ui'

interface AiOptions {
  chat?: boolean
  file?: string
  out?: string
  model?: string
  baseUrl?: string
  apiKey?: string
  maxSteps?: string
  stream?: boolean
  json?: boolean
}

interface ResolvedSettings {
  apiKey: string
  baseUrl: string
  model: string
  maxSteps: number
}

async function resolveAiSettings(options: AiOptions): Promise<ResolvedSettings> {
  const { config } = await loadWelightConfig()
  const settings = resolveModelSettings(config, {
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
  })
  const stepsRaw = Number(options.maxSteps ?? 6)
  const maxSteps = Number.isFinite(stepsRaw) && stepsRaw > 0 ? Math.min(Math.floor(stepsRaw), 20) : 6
  return { ...settings, maxSteps }
}

/** 交互式配置/写作对话（clack UI） */
async function runChat(settings: ResolvedSettings, file?: string): Promise<void> {
  if (!isInteractive()) {
    ui.error(`对话模式需要在交互式终端中运行。`)
    process.exitCode = 1
    return
  }
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    ui.error(`对话模式需要模型配置。请先设置 WELIGHT_MODEL_API_KEY，并配置模型接口 / 模型名（welight setup 或配置文件 model.baseUrl / model.model）。`)
    process.exitCode = 1
    return
  }

  p.intro(c.bgCyan(c.black(` Welight AI 助手 `)))
  p.note(
    [
      `用自然语言让我帮你配置或写作，例如：`,
      `  ${c.dim(`·`)} 帮我配置朱雀检测`,
      `  ${c.dim(`·`)} 默认主题改成 w011，代码高亮用 atom-one-light`,
      `  ${c.dim(`·`)} 现在朱雀和公众号都配好了吗`,
      ``,
      `${c.dim(`密钥由本地安全输入，不会发送给模型。输入 exit 退出。`)}`,
    ].join(`\n`),
    `可以这样用`,
  )

  let spinner: ReturnType<typeof p.spinner> | null = null

  const session = new AgentSession({
    content: file ? await readInput(file) : ``,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    maxSteps: settings.maxSteps,
    onEvent: message => spinner?.message(`${message}…`),
    requestSecret: async (_name: string, label: string) => {
      spinner?.stop(`需要一项配置`)
      spinner = null
      const value = await promptSecret(label)
      spinner = p.spinner()
      spinner.start(`继续处理…`)
      return value
    },
  })

  while (true) {
    const input = await promptInput(`你`)
    if (input === null)
      break
    if (!input || [`exit`, `quit`, `:q`].includes(input.toLowerCase()))
      break

    if (file)
      session.setContent(await readInput(file))

    spinner = p.spinner()
    spinner.start(`AI 正在处理…`)
    try {
      const reply = await session.send(input)
      spinner.stop(`AI`)
      spinner = null
      p.log.message(reply || c.dim(`（空回复）`))
    }
    catch (error) {
      spinner?.stop(`出错`)
      spinner = null
      p.log.error(error instanceof Error ? error.message : String(error))
    }
  }

  p.outro(`再见`)
}

/** 单轮执行 */
async function runOnce(prompt: string, options: AiOptions, settings: ResolvedSettings): Promise<void> {
  const content = options.file ? await readInput(options.file) : ``
  const shouldStream = (options.stream ?? true) && !options.out && !options.json

  let result: string
  let streamed = false
  try {
    result = await runAgent({
      prompt,
      content,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      maxSteps: settings.maxSteps,
      onEvent: message => ui.info(message),
      requestSecret: isInteractive()
        ? async (_name, label) => promptSecret(label)
        : undefined,
      onDelta: shouldStream
        ? (text) => {
            streamed = true
            process.stdout.write(text)
          }
        : undefined,
    })
  }
  catch (error) {
    ui.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }

  if (shouldStream) {
    if (streamed)
      process.stdout.write(`\n`)
    else if (result)
      process.stdout.write(result.endsWith(`\n`) ? result : `${result}\n`)
    return
  }
  if (options.out) {
    await fs.writeFile(options.out, result.endsWith(`\n`) ? result : `${result}\n`, `utf8`)
    ui.success(`已写入 ${options.out}`)
    return
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ result, model: settings.model || undefined }, null, 2)}\n`)
    return
  }
  process.stdout.write(result.endsWith(`\n`) ? result : `${result}\n`)
}

const commonAiOptions = (command: Command): Command =>
  command
    .option(`-f, --file <path>`, `文章文件路径（作为上下文）`)
    .option(`-o, --out <path>`, `把结果写入文件，缺省输出到 stdout`)
    .option(`--model <name>`, `模型名（默认读配置 / WELIGHT_MODEL）`)
    .option(`--base-url <url>`, `OpenAI 兼容接口地址（默认读配置 / WELIGHT_MODEL_BASE_URL）`)
    .option(`--api-key <key>`, `模型 API Key（默认读本地凭据 / WELIGHT_MODEL_API_KEY）`)
    .option(`--max-steps <n>`, `最大工具调用步数，默认 6`)
    .option(`--stream`, `流式输出（默认开启）`)
    .option(`--no-stream`, `关闭流式输出`)
    .option(`--json`, `以 JSON 输出`)

export function registerAi(program: Command): void {
  commonAiOptions(
    program
      .command(`ai`)
      .description(`Welight AI：写作助手 + 配置助手（BYOK 模型 + CLI 工具）`)
      .argument(`[prompt]`, `指令；配合 --chat 可省略`)
      .option(`--chat`, `进入多轮对话（配置助手 / 连续创作）`),
  )
    .addHelpText(`after`, `\n示例:\n  $ welight ai "帮我润色这篇文章" --file post.md\n  $ welight ai --chat\n  $ welight ai "这篇文章有没有平台规则风险？" --file post.md`)
    .action(async (prompt: string | undefined, options: AiOptions) => {
      installDom()
      const settings = await resolveAiSettings(options)

      if (options.chat) {
        await runChat(settings, options.file)
        return
      }
      if (!prompt) {
        ui.error(`请提供指令，或使用 --chat 进入对话模式。`)
        process.exitCode = 1
        return
      }
      await runOnce(prompt, options, settings)
    })
}

export function registerSetup(program: Command): void {
  commonAiOptions(
    program
      .command(`setup`)
      .description(`配置助手：通过对话完成模型 / 朱雀 / TypeSafe / 公众号等配置`),
  )
    .addHelpText(`after`, `\n非敏感项写入 welight.config.json；密钥由本地安全输入并保存到本地凭据文件，\n不会发送给模型。\n\n示例:\n  $ welight setup`)
    .action(async (options: AiOptions) => {
      installDom()
      const settings = await resolveAiSettings(options)
      await runChat(settings, options.file)
    })
}
