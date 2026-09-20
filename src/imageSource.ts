/**
 * 图片字节读取：把 HTML 中的图片地址解析为可上传的字节。
 *
 * 支持 data: URL、http(s) URL、本地文件路径（相对 Markdown 文件目录）。
 * 微信 CDN（mmbiz.qpic.cn）的图片已在微信侧，跳过不上传。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { isWeChatCdnUrl } from './wechatApi'

export interface ImageBytes {
  bytes: Uint8Array
  fileName: string
  mimeType: string
}

export function inferMimeType(nameOrUrl: string, fallback = `image/jpeg`): string {
  const lower = nameOrUrl.toLowerCase().split(`?`)[0]
  if (lower.endsWith(`.png`))
    return `image/png`
  if (lower.endsWith(`.gif`))
    return `image/gif`
  if (lower.endsWith(`.webp`))
    return `image/webp`
  if (lower.endsWith(`.jpg`) || lower.endsWith(`.jpeg`))
    return `image/jpeg`
  return fallback
}

export function inferFileName(nameOrUrl: string, index = 0, fallbackExt = `jpg`): string {
  const cleaned = nameOrUrl.split(`?`)[0].split(`#`)[0]
  const last = cleaned.replace(/\\/g, `/`).split(`/`).pop()
  if (last && /\.[a-z0-9]{2,5}$/i.test(last))
    return last
  return `image_${index}.${fallbackExt}`
}

function extFromMime(mime: string): string {
  if (mime.includes(`png`))
    return `png`
  if (mime.includes(`gif`))
    return `gif`
  if (mime.includes(`webp`))
    return `webp`
  return `jpg`
}

function decodeDataUrl(src: string, index: number): ImageBytes | null {
  const [meta, payload] = src.split(`,`)
  if (!payload)
    return null
  const mimeType = meta.match(/^data:([^;]+)/)?.[1] ?? `image/jpeg`
  return {
    bytes: new Uint8Array(Buffer.from(payload, `base64`)),
    fileName: `image_${index}.${extFromMime(mimeType)}`,
    mimeType,
  }
}

/**
 * 读取图片字节；无法读取或应跳过时返回 null。
 * @param baseDir 相对路径的基准目录（通常是 Markdown 文件所在目录）
 */
export async function loadImageBytes(src: string, baseDir: string, index = 0): Promise<ImageBytes | null> {
  const value = (src ?? ``).trim()
  if (!value)
    return null

  if (value.startsWith(`data:image`))
    return decodeDataUrl(value, index)

  if (/^https?:\/\//i.test(value)) {
    if (isWeChatCdnUrl(value))
      return null
    try {
      const response = await fetch(value)
      if (!response.ok)
        return null
      const mimeType = response.headers.get(`content-type`)?.split(`;`)[0] || inferMimeType(value)
      const buffer = new Uint8Array(await response.arrayBuffer())
      return { bytes: buffer, fileName: inferFileName(value, index), mimeType }
    }
    catch {
      return null
    }
  }

  const localPath = path.isAbsolute(value) ? value : path.resolve(baseDir, value)
  try {
    const buffer = await fs.readFile(localPath)
    return {
      bytes: new Uint8Array(buffer),
      fileName: inferFileName(localPath, index),
      mimeType: inferMimeType(localPath),
    }
  }
  catch {
    return null
  }
}
