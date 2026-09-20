/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@d9c82255
 * 重新生成：node scripts/export-engine.mjs
 */
import type { RendererAPI } from '../shared/types'
import type { ReadTimeResults } from 'reading-time'
import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'

/**
 * 渲染 Markdown 内容
 * @param raw - 原始 markdown 字符串
 * @param renderer - 渲染器 API
 * @returns 渲染结果，包含 HTML 和阅读时间
 */
export function renderMarkdown(raw: string, renderer: RendererAPI) {
  // 解析 front-matter 和正文
  const { markdownContent, readingTime }
    = renderer.parseFrontMatterAndContent(raw)

  // marked -> html
  // 注意：XSS 消毒统一放在 postProcessHtml 末尾，对追加脚注等内容后的完整 HTML 消毒
  const html = marked.parse(markdownContent) as string

  return { html, readingTime }
}

/**
 * 后处理 HTML 内容
 * @param baseHtml - 基础 HTML 字符串
 * @param reading - 阅读时间结果
 * @param renderer - 渲染器 API
 * @returns 处理后的 HTML 字符串
 */
export function postProcessHtml(baseHtml: string, reading: ReadTimeResults, renderer: RendererAPI): string {
  // 阅读时间及字数统计
  let html = baseHtml
  html = renderer.buildReadingTime(reading) + html
  // 新主题系统：通过 CSS 去除第一行的 margin-top
  // html = html.replace(/(style=".*?)"/, `$1;margin-top: 0"`)
  // 引用脚注
  html += renderer.buildFootnotes()
  // 附加的一些 style
  html += renderer.buildAddition()
  html += `
    <style>
      .hljs.code__pre > .mac-sign {
        display: ${renderer.getOpts().isMacCodeBlock ? `flex` : `none`};
      }
    </style>
  `
  html += `
    <style>
      h2 strong {
        color: inherit !important;
      }
    </style>
  `
  // 包裹 HTML
  const wrapped = renderer.createContainer(html)
  // XSS 处理：脚注标题/链接等来自用户 Markdown 原文，必须在全部内容拼接完成后统一消毒
  return DOMPurify.sanitize(wrapped, { ADD_TAGS: [`mp-common-profile`] })
}

/**
 * 修改 HTML 内容
 * @param content - 原始内容
 * @param renderer - 渲染器 API
 * @returns 修改后的 HTML 字符串
 */
export function modifyHtmlContent(content: string, renderer: RendererAPI): string {
  const {
    markdownContent,
    readingTime: readingTimeResult,
  } = renderer.parseFrontMatterAndContent(content)

  // XSS 消毒由 postProcessHtml 末尾统一处理
  const html = marked.parse(markdownContent) as string
  return postProcessHtml(html, readingTimeResult, renderer)
}
