/**
 * 最小 Agent 循环（CLI-only）：模型可调用 CLI 原生工具，多步后给出最终答复。
 */

import type { ChatMessage, ToolDef } from '../modelClient'
import { chatCompletionMessage, chatCompletionStream } from '../modelClient'
import type { AgentDocument } from './tools'
import { AI_TOOLS } from './tools'

const SYSTEM_PROMPT = `你是 Welight CLI 的中文写作助手，帮助用户创作、润色和检查微信公众号文章。

你可以调用以下工具：
- check_wechat_rules：检查文章命中的公众号平台规则；
- detect_ai_text：评估文章的 AI 生成占比；
- list_themes：查看可用的免费主题；
- article_stats：统计篇幅与结构（字数/阅读时间/标题/图片等）；
- render_article：用指定主题渲染并保存公众号内联 HTML；
- render_document：用指定主题渲染并保存独立 HTML（浏览器预览）；
- score_titles：给候选标题按打开潜力评分排序。

规则：
- 先判断是否需要工具；不需要就直接回答，不要为了用工具而用工具。
- 工具结果是线索而非结论，请结合语境给出建议，不要武断判定违规。
- 不能直接发布文章；如需发布请告知用户使用 welight publish 命令。
- 输出使用简体中文，直接给出可用结果，避免空泛套话。`

export interface AgentOptions {
  prompt: string
  content: string
  baseUrl: string
  apiKey: string
  model: string
  maxSteps?: number
  timeoutMs?: number
  onEvent?: (message: string) => void
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

export async function runAgent(options: AgentOptions): Promise<string> {
  const toolDefs: ToolDef[] = AI_TOOLS.map(tool => ({
    type: `function`,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))

  const messages: ChatMessage[] = [
    { role: `system`, content: SYSTEM_PROMPT },
    { role: `user`, content: buildUserMessage(options.prompt, options.content) },
  ]
  const doc: AgentDocument = { content: options.content }
  const maxSteps = options.maxSteps ?? 6

  for (let step = 0; step < maxSteps; step += 1) {
    const requestOptions = {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      messages,
      tools: toolDefs,
      timeoutMs: options.timeoutMs,
    }
    const message = options.onDelta
      ? await chatCompletionStream(requestOptions, options.onDelta)
      : await chatCompletionMessage(requestOptions)
    messages.push(message)

    if (message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        const tool = AI_TOOLS.find(item => item.name === call.function.name)
        let result: string
        if (!tool) {
          result = `未知工具：${call.function.name}`
        }
        else {
          options.onEvent?.(`调用工具 ${call.function.name}`)
          try {
            result = await tool.run(safeParseArguments(call.function.arguments), doc)
          }
          catch (error) {
            result = `工具执行失败：${error instanceof Error ? error.message : String(error)}`
          }
        }
        messages.push({ role: `tool`, tool_call_id: call.id, content: result })
      }
      continue
    }

    return message.content?.trim() ?? ``
  }

  throw new Error(`达到最大工具调用步数（${maxSteps}）`)
}
