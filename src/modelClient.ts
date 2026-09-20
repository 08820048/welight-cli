/**
 * 最小 OpenAI 兼容聊天客户端（BYOK）。
 *
 * 覆盖 OpenAI / DeepSeek / 通义兼容模式 / OpenRouter / SiliconFlow 等
 * 提供 `/chat/completions` 的服务。CLI 不内置任何官方模型服务。
 */

export interface ChatMessage {
  role: `system` | `user` | `assistant`
  content: string
}

export interface ChatOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export async function chatCompletion(options: ChatOptions): Promise<string> {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, ``)
  if (!baseUrl)
    throw new Error(`缺少模型接口地址（--base-url 或 WELIGHT_MODEL_BASE_URL）`)
  if (!options.model.trim())
    throw new Error(`缺少模型名（--model 或 WELIGHT_MODEL）`)
  if (!options.apiKey.trim())
    throw new Error(`缺少模型 API Key（--api-key 或 WELIGHT_MODEL_API_KEY）`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: `POST`,
      headers: {
        'content-type': `application/json`,
        'authorization': `Bearer ${options.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: options.model.trim(),
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null) as ChatResponse | null
    if (!response.ok) {
      const message = data?.error?.message || `模型接口 HTTP ${response.status}`
      if (response.status === 401)
        throw new Error(`模型 API Key 无效或已过期`)
      throw new Error(message)
    }

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== `string` || !content.trim())
      throw new Error(`模型未返回内容`)
    return content.trim()
  }
  catch (error) {
    if (error instanceof Error && error.name === `AbortError`)
      throw new Error(`模型请求超时`)
    throw error
  }
  finally {
    clearTimeout(timeout)
  }
}

/** 解析模型返回的标题列表：去掉编号/项目符号/空行/引号 */
export function parseTitleList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^#{1,6}\s*/, ``).replace(/^[\d]+[.、)］\]]\s*/, ``).replace(/^[-*+]\s+/, ``))
    .map(line => line.replace(/^[“”"']+|[“”"']+$/g, ``).trim())
    .filter(line => line.length > 0)
}
