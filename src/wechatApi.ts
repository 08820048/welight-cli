/**
 * 微信公众号 API 直连客户端（无官方代理）。
 *
 * 对应桌面端的 Rust 命令 mp_get_access_token / mp_upload_image /
 * mp_upload_material / mp_add_draft / mp_draft_get，这里用 Node fetch 实现。
 *
 * 默认直连 https://api.weixin.qq.com；用户可用 ---proxy 指定自建反向代理，
 * 但需自行保证出口 IP 已加入公众号后台的 IP 白名单。
 */

const DEFAULT_BASE_URL = `https://api.weixin.qq.com`

export interface WechatCredentials {
  appId: string
  appSecret: string
  /** 自建反向代理 origin，留空则直连微信 */
  proxy?: string
}

export interface UploadImageInput {
  bytes: Uint8Array
  fileName: string
  mimeType: string
}

export class WechatApiError extends Error {
  readonly errcode: number

  constructor(errcode: number, errmsg: string, raw?: unknown) {
    super(WechatApiError.describe(errcode, errmsg, raw))
    this.name = `WechatApiError`
    this.errcode = errcode
  }

  static describe(errcode: number, errmsg: string, raw?: unknown): string {
    if (errcode === 40164) {
      return `微信返回 40164（IP 未加入白名单）：CLI 不使用官方代理，请把当前网络出口 IP 加入公众号后台「开发 → 基本配置 → IP 白名单」后重试。原始信息：${errmsg}`
    }
    const detail = raw ? `：${JSON.stringify(raw)}` : ``
    return `微信接口错误 ${errcode}（${errmsg}）${detail}`
  }
}

const TOKEN_ERROR_CODES = new Set([40001, 40014, 42001])

export function isTokenError(error: unknown): boolean {
  return error instanceof WechatApiError && TOKEN_ERROR_CODES.has(error.errcode)
}

function resolveBaseUrl(proxy?: string): string {
  const value = (proxy ?? ``).trim()
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, ``)
}

async function requestJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, init)
  const text = await response.text()

  let json: any
  try {
    json = JSON.parse(text)
  }
  catch {
    throw new Error(`微信接口返回非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`)
  }

  if (typeof json?.errcode === `number` && json.errcode !== 0) {
    throw new WechatApiError(json.errcode, String(json.errmsg ?? ``), json)
  }
  if (!response.ok) {
    throw new Error(`微信接口 HTTP ${response.status}：${text.slice(0, 200)}`)
  }

  return json
}

async function uploadMultipart(url: string, input: UploadImageInput): Promise<any> {
  const form = new FormData()
  form.append(`media`, new Blob([input.bytes as unknown as BlobPart], { type: input.mimeType }), input.fileName)
  return requestJson(url, { method: `POST`, body: form })
}

export async function getAccessToken(credentials: WechatCredentials): Promise<string> {
  const url = `${resolveBaseUrl(credentials.proxy)}/cgi-bin/stable_token`
  const json = await requestJson(url, {
    method: `POST`,
    headers: { 'content-type': `application/json` },
    body: JSON.stringify({
      grant_type: `client_credential`,
      appid: credentials.appId.trim(),
      secret: credentials.appSecret.trim(),
    }),
  })

  const token = json?.access_token
  if (typeof token !== `string` || !token)
    throw new Error(`未获取到 access_token：${JSON.stringify(json)}`)
  return token
}

function isWeChatCdnUrl(url: string): boolean {
  try {
    const host = new URL(url).host
    return host.includes(`mmbiz.qpic.cn`) || host.includes(`mmbiz.qlogo.cn`)
  }
  catch {
    return false
  }
}

export { isWeChatCdnUrl }

/**
 * 上传正文图片，返回可访问的 URL。
 * 小于 1MB 的 jpg/png 走 media/uploadimg（临时素材，返回 url）；
 * 其余走 material/add_material（永久素材，同时返回 url）。
 */
export async function uploadContentImage(
  accessToken: string,
  input: UploadImageInput,
  proxy?: string,
): Promise<string> {
  const sizeMb = input.bytes.byteLength / (1024 * 1024)
  const isJpegOrPng = [`image/jpeg`, `image/png`].includes(input.mimeType.toLowerCase())
  const base = resolveBaseUrl(proxy)

  const useUploadImg = sizeMb < 1 && isJpegOrPng
  const path = useUploadImg
    ? `/cgi-bin/media/uploadimg?access_token=${accessToken}`
    : `/cgi-bin/material/add_material?access_token=${accessToken}&type=image`

  const json = await uploadMultipart(`${base}${path}`, input)
  const url = typeof json?.url === `string` ? json.url : ``
  if (!url)
    throw new Error(`正文图片上传未返回 URL：${JSON.stringify(json)}`)
  return url.replace(/^http:\/\//i, `https://`)
}

/** 上传永久素材（封面），返回 media_id */
export async function uploadMaterial(
  accessToken: string,
  input: UploadImageInput,
  proxy?: string,
): Promise<string> {
  const base = resolveBaseUrl(proxy)
  const url = `${base}/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
  const json = await uploadMultipart(url, input)
  const mediaId = typeof json?.media_id === `string` ? json.media_id : ``
  if (!mediaId)
    throw new Error(`封面素材上传未返回 media_id：${JSON.stringify(json)}`)
  return mediaId
}

export interface DraftArticle {
  title: string
  content: string
  thumbMediaId: string
  author?: string
  digest?: string
  contentSourceUrl?: string
  openComment?: boolean
  fansCommentOnly?: boolean
}

function buildArticle(article: DraftArticle) {
  if (article.author && article.author.length > 16)
    throw new Error(`作者长度不能超过 16 个字符`)
  if (article.digest && article.digest.length > 120)
    throw new Error(`摘要长度不能超过 120 个字符`)
  if (article.fansCommentOnly && !article.openComment)
    throw new Error(`仅粉丝可评论需要先开启评论`)

  const payload: Record<string, unknown> = {
    article_type: `news`,
    title: article.title,
    content: article.content,
    thumb_media_id: article.thumbMediaId,
    need_open_comment: article.openComment ? 1 : 0,
    only_fans_can_comment: article.fansCommentOnly ? 1 : 0,
  }
  if (article.author)
    payload.author = article.author
  if (article.digest)
    payload.digest = article.digest
  if (article.contentSourceUrl)
    payload.content_source_url = article.contentSourceUrl
  return payload
}

export async function addDraft(
  accessToken: string,
  article: DraftArticle,
  proxy?: string,
): Promise<string> {
  const base = resolveBaseUrl(proxy)
  const json = await requestJson(`${base}/cgi-bin/draft/add?access_token=${accessToken}`, {
    method: `POST`,
    headers: { 'content-type': `application/json` },
    body: JSON.stringify({ articles: [buildArticle(article)] }),
  })
  const mediaId = typeof json?.media_id === `string` ? json.media_id : ``
  if (!mediaId)
    throw new Error(`创建草稿未返回 media_id：${JSON.stringify(json)}`)
  return mediaId
}

/** 读取草稿详情，返回预览链接（可能为空） */
export async function getDraftPreviewUrl(
  accessToken: string,
  mediaId: string,
  proxy?: string,
): Promise<string> {
  const base = resolveBaseUrl(proxy)
  const json = await requestJson(`${base}/cgi-bin/draft/get?access_token=${accessToken}`, {
    method: `POST`,
    headers: { 'content-type': `application/json` },
    body: JSON.stringify({ media_id: mediaId }),
  })
  const url = json?.news_item?.[0]?.url
  return typeof url === `string` && /^https?:\/\//i.test(url.trim()) ? url.trim() : ``
}
