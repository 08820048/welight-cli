/**
 * 发布到公众号草稿的编排：渲染内联 HTML -> 上传图片/封面 -> 创建草稿 -> 取预览链接。
 * 与桌面端 createWechatDraft 的流程一致，但走 CLI 的直连实现（无官方代理）。
 */

import type { WechatCredentials } from './wechatApi'
import { addDraft, getAccessToken, getDraftPreviewUrl, isTokenError, uploadContentImage, uploadMaterial } from './wechatApi'
import type { WeChatOptions } from './wechat'
import { loadImageBytes } from './imageSource'
import { appendWatermark } from './watermark'
import { buildWeChatInlineHtml } from './wechat'

const MAX_TITLE_LENGTH = 64

export interface PublishOptions extends WeChatOptions {
  /** Markdown 文件所在目录，用于解析相对图片路径 */
  baseDir: string
  credentials: WechatCredentials
  title?: string
  author?: string
  digest?: string
  contentSourceUrl?: string
  openComment?: boolean
  fansCommentOnly?: boolean
  cover?: string
  /** 默认 true */
  watermark?: boolean
  /** 是否轮询草稿预览链接 */
  preview?: boolean
  onLog?: (message: string) => void
}

export interface PublishResult {
  title: string
  mediaId: string
  previewUrl: string
  contentImageCount: number
  uploadedContentImageCount: number
  usedCoverFromContent: boolean
}

/** 从 front-matter / 一级标题推断标题 */
export function inferTitle(markdown: string, fallback: string): string {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (frontMatter) {
    const match = /^title:\s*["']?(.+?)["']?\s*$/m.exec(frontMatter[1])
    if (match?.[1])
      return match[1].trim()
  }
  const heading = /^#\s+(.+)$/m.exec(markdown)
  if (heading?.[1])
    return heading[1].trim()
  return fallback
}

export function sanitizeArticleTitle(raw: string): string {
  const normalized = raw.replace(/[\\/:*?"<>|]/g, `_`).replace(/\s+/g, ` `).trim()
  if (!normalized)
    throw new Error(`请填写文章标题`)
  if (normalized.length > MAX_TITLE_LENGTH)
    throw new Error(`文章标题不能超过 ${MAX_TITLE_LENGTH} 个字符`)
  return normalized
}

export async function publishDraft(markdown: string, options: PublishOptions): Promise<PublishResult> {
  const log = (message: string) => options.onLog?.(message)
  const title = sanitizeArticleTitle(options.title || inferTitle(markdown, `未命名文章`))

  log(`正在获取 Access Token...`)
  let token = await getAccessToken(options.credentials)
  log(`Access Token 获取成功`)

  const callWithToken = async <T>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
    try {
      return await fn(token)
    }
    catch (error) {
      if (!isTokenError(error))
        throw error
      log(`Access Token 失效，正在刷新...`)
      token = await getAccessToken(options.credentials)
      return await fn(token)
    }
  }

  const html = buildWeChatInlineHtml(markdown, options)
  const container = document.createElement(`div`)
  container.innerHTML = html
  const images = Array.from(container.querySelectorAll(`img`))
  const srcs = images.map(img => img.getAttribute(`src`) || ``).filter(Boolean)

  // 封面：优先 --cover，否则用正文首图
  let thumbMediaId = ``
  let usedCoverFromContent = false
  const coverSrc = options.cover?.trim() || srcs[0] || ``
  if (coverSrc) {
    log(options.cover ? `正在上传封面图...` : `未指定封面，使用正文首图作为封面...`)
    const cover = await loadImageBytes(coverSrc, options.baseDir, 0)
    if (cover) {
      thumbMediaId = await callWithToken(accessToken => uploadMaterial(accessToken, cover, options.credentials.proxy))
      usedCoverFromContent = !options.cover
      log(`封面素材上传成功`)
    }
  }
  if (!thumbMediaId)
    throw new Error(`必须提供封面图（--cover），或让正文包含一张可读取的图片作为封面`)

  // 正文图片：上传并替换为微信 URL
  let uploaded = 0
  for (let index = 0; index < images.length; index += 1) {
    const img = images[index]
    const src = img.getAttribute(`src`) || ``
    if (!src)
      continue
    const data = await loadImageBytes(src, options.baseDir, index)
    if (!data)
      continue
    log(`正在上传正文图片 ${index + 1}/${images.length}...`)
    const url = await callWithToken(accessToken => uploadContentImage(accessToken, data, options.credentials.proxy))
    img.setAttribute(`src`, url)
    uploaded += 1
  }

  let finalHtml = container.innerHTML
  if (options.watermark !== false)
    finalHtml = appendWatermark(finalHtml)

  log(`正在创建公众号草稿...`)
  const mediaId = await callWithToken(accessToken => addDraft(accessToken, {
    title,
    content: finalHtml,
    thumbMediaId,
    author: options.author,
    digest: options.digest,
    contentSourceUrl: options.contentSourceUrl,
    openComment: options.openComment,
    fansCommentOnly: options.fansCommentOnly,
  }, options.credentials.proxy))
  log(`草稿创建成功（media_id=${mediaId}）`)

  let previewUrl = ``
  if (options.preview) {
    const attempts = 3
    for (let attempt = 1; attempt <= attempts && !previewUrl; attempt += 1) {
      try {
        previewUrl = await callWithToken(accessToken => getDraftPreviewUrl(accessToken, mediaId, options.credentials.proxy))
      }
      catch (error) {
        log(`获取草稿预览地址失败（${attempt}/${attempts}）：${error instanceof Error ? error.message : String(error)}`)
      }
      if (!previewUrl && attempt < attempts)
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    if (previewUrl)
      log(`草稿预览链接：${previewUrl}`)
    else
      log(`未获取到预览链接，可到公众号后台草稿箱查看`)
  }

  return {
    title,
    mediaId,
    previewUrl,
    contentImageCount: images.length,
    uploadedContentImageCount: uploaded,
    usedCoverFromContent,
  }
}
