import fs from 'node:fs/promises'
import process from 'node:process'
import { PasswordInput, Spinner, TextInput } from '@inkjs/ui'
import type { Command } from 'commander'
import { Box, Static, Text, useApp } from 'ink'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { AgentSession, runAgent } from '../ai/agent'
import { loadWelightConfig, resolveModelSettings } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { renderTui } from '../ink/runtime'
import { isInteractive, promptSecret } from '../prompt'
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

type ChatLine
  = { role: `user` | `assistant` | `error` | `note`, text: string }

function ChatTui({ settings, file }: { settings: ResolvedSettings, file?: string }): ReactNode {
  const { exit } = useApp()
  const [lines, setLines] = useState<ChatLine[]>([
    { role: `note`, text: `用自然语言让我帮你配置或写作。密钥由本地安全输入，不会发送给模型。输入 exit 退出。` },
  ])
  const [streaming, setStreaming] = useState(``)
  const [status, setStatus] = useState<`idle` | `thinking`>(`idle`)
  const [toolStatus, setToolStatus] = useState(``)
  const [secretLabel, setSecretLabel] = useState<string | null>(null)
  const secretResolve = useRef<((value: string | null) => void) | null>(null)
  const sessionRef = useRef<AgentSession | null>(null)

  if (sessionRef.current === null) {
    sessionRef.current = new AgentSession({
      content: ``,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      maxSteps: settings.maxSteps,
      onEvent: message => setToolStatus(message),
      requestSecret: async (_name: string, label: string) => new Promise<string | null>((resolve) => {
        secretResolve.current = resolve
        setSecretLabel(label)
      }),
    })
  }

  const submit = async (raw: string) => {
    const text = raw.trim()
    if (!text)
      return
    if ([`exit`, `quit`, `:q`].includes(text.toLowerCase())) {
      exit()
      return
    }

    setLines(prev => [...prev, { role: `user`, text }])
    setStatus(`thinking`)
    setToolStatus(``)

    if (file)
      sessionRef.current!.setContent(await readInput(file))

    try {
      const reply = await sessionRef.current!.send(text, delta => setStreaming(prev => prev + delta))
      setLines(prev => [...prev, { role: `assistant`, text: reply || `（空回复）` }])
    }
    catch (error) {
      setLines(prev => [...prev, { role: `error`, text: error instanceof Error ? error.message : String(error) }])
    }
    finally {
      setStreaming(``)
      setStatus(`idle`)
      setToolStatus(``)
    }
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Welight AI 助手</Text>
        <Text dimColor>{`  · 模型 ${settings.model}`}</Text>
      </Box>

      <Static items={lines}>
        {line => (
          <Box key={`${line.role}-${line.text.slice(0, 12)}`} marginBottom={0}>
            {line.role === `user` && <Text color="cyan">{`你  `}</Text>}
            {line.role === `assistant` && <Text color="green">{`AI  `}</Text>}
            {line.role === `error` && <Text color="red">{`错  `}</Text>}
            {line.role === `note` && <Text dimColor>{`·   `}</Text>}
            <Text wrap="wrap">{line.text}</Text>
          </Box>
        )}
      </Static>

      {streaming
        ? (
            <Box>
              <Text color="green">{`AI  `}</Text>
              <Text wrap="wrap">{streaming}</Text>
            </Box>
          )
        : null}

      {status === `thinking`
        ? (
            <Box marginTop={1}>
              <Spinner label={toolStatus || `AI 正在处理`} />
            </Box>
          )
        : null}

      {secretLabel !== null
        ? (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">{`需要配置「${secretLabel}」（输入不回显，不会发送给模型）`}</Text>
              <PasswordInput
                placeholder={`${secretLabel}`}
                onSubmit={(value) => {
                  const resolve = secretResolve.current
                  secretResolve.current = null
                  setSecretLabel(null)
                  resolve?.(value ?? ``)
                }}
              />
            </Box>
          )
        : null}

      {status === `idle` && secretLabel === null
        ? (
            <Box marginTop={1}>
              <Text color="cyan">{`你  `}</Text>
              <TextInput placeholder="输入内容，回车发送；exit 退出" onSubmit={value => void submit(value ?? ``)} />
            </Box>
          )
        : null}
    </Box>
  )
}

async function runChat(settings: ResolvedSettings, file?: string): Promise<void> {
  if (!isInteractive()) {
    ui.error(`对话模式需要在交互式终端中运行。`)
    process.exitCode = 1
    return
  }
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    ui.error(`对话模式需要模型配置。请先设置 WELIGHT_MODEL_API_KEY，并配置模型接口 / 模型名（welight config 或配置文件 model.baseUrl / model.model）。`)
    process.exitCode = 1
    return
  }

  const { waitUntilExit } = renderTui(<ChatTui settings={settings} file={file} />)
  await waitUntilExit()
}

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
      requestSecret: isInteractive() ? async (_name, label) => promptSecret(label) : undefined,
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
