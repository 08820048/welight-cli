/**
 * 最小 Agent 循环（CLI-only）：模型可调用 CLI 原生工具，多步后给出最终答复。
 * 支持单轮（runAgent）与多轮对话（AgentSession），以及本地安全收集密钥。
 */

import type { ChatMessage, ToolDef } from '../modelClient'
import { chatCompletionMessage, chatCompletionStream } from '../modelClient'
import type { AgentContext } from './tools'
import { AI_TOOLS } from './tools'

const SYSTEM_PROMPT = `你是 Welight CLI 的中文写作与配置助手，帮助用户创作、润色、检查微信公众号文章，并完成 CLI 配置。

写作相关工具：
- check_wechat_rules：检查文章命中的公众号平台规则；
- detect_ai_text：评估文章的 AI 生成占比；
- list_themes：查看可用的免费主题；
- article_stats：统计篇幅与结构（字数/阅读时间/标题/图片等）；
- layout_article：对当前文章一键排版（档位 auto/minimal/standard/rich）；
- article_checkup：对当前文章做 12 项体检（需 WELIGHT_TYPESAFE_KEY）；
- render_article：用指定主题渲染并保存公众号内联 HTML；
- render_document：用指定主题渲染并保存独立 HTML（浏览器预览）；
- score_titles：给候选标题按打开潜力评分排序。

配置相关工具：
- get_config_status：查看当前配置与各凭据是否已配置（配置前先调用）；
- save_config：写入非敏感配置（主题、代码高亮、水印、微信代理、模型接口/模型名、lint 阈值）；
- store_secret：在用户本地安全收集密钥（模型 Key、TypeSafe、朱雀、公众号 AppID/AppSecret）。

规则：
- 先判断是否需要工具；不需要就直接回答，不要为了用工具而用工具。
- 工具结果是线索而非结论，请结合语境给出建议，不要武断判定违规。
- 严禁要求用户把密钥直接粘贴到对话里；需要密钥时一律调用 store_secret，由本地安全输入。
- 不能直接发布文章；如需发布请告知用户使用 welight publish 命令。
- 输出使用简体中文，直接给出可用结果，避免空泛套话。`

export interface AgentSessionOptions {
  /** 当前文章正文（Markdown），可为空 */
  content: string
  baseUrl: string
  apiKey: string
  model: string
  maxSteps?: number
  timeoutMs?: number
  onEvent?: (message: string) => void
  /** 交互模式下的安全密钥输入回调 */
  requestSecret?: (name: string, label: string) => Promise<string | null>
}

export interface AgentOptions extends AgentSessionOptions {
  prompt: string
  /** 提供后使用流式请求，增量内容实时回调 */
  onDelta?: (text: string) => void
}

function buildUserMessage(prompt: string, content: string): string {
  if (!content.trim())
    return prompt
  return `${prompt}\n\n---\n以下是当前文章内容（Markdown）：\n\n${content}`
}

function safeParseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw)
    return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === `object` ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

const TOOL_DEFS: ToolDef[] = AI_TOOLS.map(tool => ({
  type: `function`,
  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
}))

/** 多轮会话：保留消息历史，供配置助手 / 连续对话使用 */
export class AgentSession {
  private messages: ChatMessage[]
  private content: string

  constructor(private readonly options: AgentSessionOptions) {
    this.content = options.content
    this.messages = [{ role: `system`, content: SYSTEM_PROMPT }]
  }

  setContent(content: string): void {
    this.content = content
  }

  getMessages(): ChatMessage[] {
    return this.messages
  }

  async send(prompt: string, onDelta?: (text: string) => void): Promise<string> {
    this.messages.push({ role: `user`, content: buildUserMessage(prompt, this.content) })
    return this.runLoop(onDelta)
  }

  private async runLoop(onDelta?: (text: string) => void): Promise<string> {
    const context: AgentContext = {
      content: this.content,
      requestSecret: this.options.requestSecret,
    }
    const maxSteps = this.options.maxSteps ?? 6

    for (let step = 0; step < maxSteps; step += 1) {
      const requestOptions = {
        baseUrl: this.options.baseUrl,
        apiKey: this.options.apiKey,
        model: this.options.model,
        messages: this.messages,
        tools: TOOL_DEFS,
        timeoutMs: this.options.timeoutMs,
      }
      const message = onDelta
        ? await chatCompletionStream(requestOptions, onDelta)
        : await chatCompletionMessage(requestOptions)
      this.messages.push(message)

      if (message.tool_calls?.length) {
        for (const call of message.tool_calls) {
          const tool = AI_TOOLS.find(item => item.name === call.function.name)
          let result: string
          if (!tool) {
            result = `未知工具：${call.function.name}`
          }
          else {
            this.options.onEvent?.(`调用工具 ${call.function.name}`)
            try {
              result = await tool.run(safeParseArguments(call.function.arguments), context)
            }
            catch (error) {
              result = `工具执行失败：${error instanceof Error ? error.message : String(error)}`
            }
          }
          this.messages.push({ role: `tool`, tool_call_id: call.id, content: result })
        }
        continue
      }

      return message.content?.trim() ?? ``
    }

    throw new Error(`达到最大工具调用步数（${maxSteps}）`)
  }
}

export async function runAgent(options: AgentOptions): Promise<string> {
  const session = new AgentSession(options)
  return session.send(options.prompt, options.onDelta)
}
