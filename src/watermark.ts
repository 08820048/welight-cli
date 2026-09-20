/**
 * 发布到公众号时追加文末水印（与桌面端 appendWelightPublishWatermark 行为一致）。
 * 仅用于发布链路，不修改用户原始内容。
 */

const WATERMARK_TEXT = `本文采用 Welight 进行创作排版，下载地址:`
const WATERMARK_URL = `https://welight.fyi`
const LEGACY_WATERMARK_URL = `https://waer.ltd`

export function appendWatermark(html: string): string {
  const raw = String(html ?? ``)
  if (!raw.trim())
    return raw

  const doc = new DOMParser().parseFromString(raw, `text/html`)
  const existed = doc.body.querySelector(`[data-welight-watermark="true"]`)
  const bodyText = (doc.body.textContent || ``).replace(/\s+/g, ` `)
  if (
    existed
    || (bodyText.includes(`本文采用 Welight 进行创作排版`)
      && (bodyText.includes(WATERMARK_URL) || bodyText.includes(LEGACY_WATERMARK_URL)))
  ) {
    return doc.body.innerHTML
  }

  const paragraph = doc.createElement(`p`)
  paragraph.setAttribute(`data-welight-watermark`, `true`)
  paragraph.style.cssText = [
    `margin: 20px 0 0`,
    `padding-top: 10px`,
    `border-top: 1px solid rgba(0, 0, 0, 0.08)`,
    `font-size: 12px`,
    `line-height: 1.6`,
    `color: rgba(0, 0, 0, 0.42)`,
    `text-align: left`,
    `word-break: break-word`,
  ].join(`;`)

  const label = doc.createElement(`span`)
  label.textContent = WATERMARK_TEXT
  label.style.cssText = `opacity: 0.9;`
  paragraph.append(label)

  const link = doc.createElement(`a`)
  link.href = WATERMARK_URL
  link.textContent = WATERMARK_URL
  link.style.cssText = [`color: #576b95`, `text-decoration: none`, `font-size: 12px`, `margin-left: 2px`].join(`;`)
  paragraph.append(link)
  doc.body.append(paragraph)

  return doc.body.innerHTML
}
