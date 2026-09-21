import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { AgentSession, runAgent } from '../ai/agent'
import { loadWelightConfig, resolveModelSettings } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { assistantLabel, LiveMarkdown } from '../live'
import { markdownToAnsi } from '../markdown/ansi'
import { p } from '../present'
import { askConfirm, askPassword, isInteractive, promptInput } from '../prompt'
import { resolveArticleTheme } from '../themeMemory'
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
  missing: string[]
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
  const missing: string[] = []
  if (!settings.baseUrl)
    missing.push(`模型接口（--base-url 或 model.baseUrl）`)
  if (!settings.model)
    missing.push(`模型名（--model 或 model.model）`)
  if (!settings.apiKey)
    missing.push(`模型密钥（welight auth set model）`)
  return { ...settings, maxSteps, missing }
}

function missingMessage(settings: ResolvedSettings): string {
  return `模型配置不完整，缺少：${settings.missing.join(`、`)}。\n运行 welight model 或 welight setup 补全。`
}

/** 交互式配置/写作对话（clack；实时流式 + Markdown 渲染） */
async function runChat(settings: ResolvedSettings, file?: string): Promise<void> {
  if (settings.missing.length > 0) {
    ui.error(missingMessage(settings))
    process.exitCode = 1
    return
  }
  if (!isInteractive()) {
    ui.error(`对话模式需要在交互式终端中运行。`)
    process.exitCode = 1
    return
  }

  p.intro(c.bgCyan(c.black(` Welight AI `)))
  p.note(
    [
      `用自然语言让我帮你配置或写作，例如：`,
      `  ${c.dim(`·`)} 帮我配置朱雀检测`,
      `  ${c.dim(`·`)} 默认主题改成 w011，代码高亮用 atom-one-light`,
      `  ${c.dim(`·`)} 用简约档把文章排一下版`,
      ``,
      `${c.dim(`密钥由本地安全输入，不会发送给模型。输入 exit 退出。`)}`,
    ].join(`\n`),
    `可以这样用`,
  )

  let spinner: ReturnType<typeof p.spinner> | null = null

  const { config } = await loadWelightConfig()
  const filePath = file && file !== `-` ? file : ``
  const baseDir = filePath ? path.dirname(path.resolve(filePath)) : process.cwd()
  const theme = resolveArticleTheme(config, filePath || `-`).theme

  const session = new AgentSession({
    content: file ? await readInput(file) : ``,
    baseDir,
    theme,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    maxSteps: settings.maxSteps,
    onEvent: message => spinner?.message(`${message}…`),
    confirm: async (message: string) => askConfirm(message),
    requestSecret: async (_name: string, label: string) => {
      spinner?.stop(`需要一项配置`)
      spinner = null
      const value = await askPassword(label)
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

    const live = { current: null as LiveMarkdown | null }
    spinner = p.spinner()
    spinner.start(`WelightAI 正在处理…`)
    try {
      const reply = await session.send(input, (delta) => {
        if (!live.current) {
          spinner?.clear()
          spinner = null
          live.current = new LiveMarkdown()
        }
        live.current.append(delta)
      })
      if (live.current) {
        live.current.finish()
      }
      else {
        spinner?.stop(assistantLabel())
        process.stdout.write(`${markdownToAnsi(reply || `（空回复）`)}\n\n`)
      }
      spinner = null
    }
    catch (error) {
      live.current?.finish()
      spinner?.clear()
      spinner = null
      p.log.error(error instanceof Error ? error.message : String(error))
    }
  }

  p.outro(`再见`)
}

/** 单轮执行 */
async function runOnce(prompt: string, options: AiOptions, settings: ResolvedSettings): Promise<void> {
  if (settings.missing.length > 0) {
    ui.error(missingMessage(settings))
    process.exitCode = 1
    return
  }
  const content = options.file ? await readInput(options.file) : ``
  const explicitStream = options.stream === true
  const renderMarkdown = !explicitStream && !options.json && !options.out && isInteractive()
  const shouldStream = explicitStream && !options.out && !options.json

  const { config } = await loadWelightConfig()
  const filePath = options.file && options.file !== `-` ? options.file : ``
  const baseDir = filePath ? path.dirname(path.resolve(filePath)) : process.cwd()
  const theme = resolveArticleTheme(config, filePath || `-`).theme

  const live = { current: null as LiveMarkdown | null }
  const spinner = renderMarkdown ? p.spinner() : null
  spinner?.start(`WelightAI 正在处理…`)

  let result: string
  let streamed = false
  try {
    result = await runAgent({
      prompt,
      content,
      baseDir,
      theme,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      maxSteps: settings.maxSteps,
      onEvent: message => spinner?.message(`${message}…`),
      confirm: isInteractive() ? async (message: string) => askConfirm(message) : undefined,
      requestSecret: isInteractive() ? async (_name, label) => askPassword(label) : undefined,
      onDelta: shouldStream
        ? (text) => {
            streamed = true
            process.stdout.write(text)
          }
        : renderMarkdown
          ? (text) => {
              if (!live.current) {
                spinner?.clear()
                live.current = new LiveMarkdown()
              }
              live.current.append(text)
            }
          : undefined,
    })
  }
  catch (error) {
    live.current?.finish()
    spinner?.clear()
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
  if (renderMarkdown) {
    if (live.current) {
      live.current.finish()
    }
    else {
      spinner?.stop(assistantLabel())
      process.stdout.write(`${markdownToAnsi(result || `（空回复）`)}\n`)
    }
    return
  }
  spinner?.stop(assistantLabel())
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

export function registerAi(program: Command): void {
  commonAiOptions(
    program
      .command(`ai`)
      .description(`Welight AI：写作助手 + 配置助手（BYOK 模型 + CLI 工具）`)
      .argument(`[prompt]`, `指令；配合 --chat 可省略`)
      .option(`--chat`, `进入多轮对话（等价 welight chat）`)
      .option(`--stream`, `流式输出原始 Markdown（不渲染）`)
      .option(`--json`, `以 JSON 输出`),
  )
    .addHelpText(`after`, `\n示例:\n  $ welight ai "帮我润色这篇文章" --file post.md\n  $ welight chat\n  $ welight ai "用简约档排版" --file post.md`)
    .action(async (prompt: string | undefined, options: AiOptions) => {
      installDom()
      const settings = await resolveAiSettings(options)

      if (options.chat) {
        await runChat(settings, options.file)
        return
      }
      if (!prompt) {
        ui.error(`请提供指令，或使用 welight chat 进入对话模式。`)
        process.exitCode = 1
        return
      }
      await runOnce(prompt, options, settings)
    })
}

export function registerChat(program: Command): void {
  commonAiOptions(
    program
      .command(`chat`)
      .description(`打开 Welight AI 对话（写作 / 配置助手）`),
  )
    .addHelpText(`after`, `\n示例:\n  $ welight chat\n  $ welight chat --file post.md`)
    .action(async (options: AiOptions) => {
      installDom()
      const settings = await resolveAiSettings(options)
      await runChat(settings, options.file)
    })
}
