/**
 * 生成可粘贴到公众号后台的内联 HTML。
 *
 * 与桌面端 processClipboardContent 的目标一致：
 *   body + 主题 CSS -> juice 内联 -> 解析 CSS 变量 -> 兼容性修正 -> 清理 <style>
 *
 * 纯字符串处理复用从 GUI 导出的 @md/core/wechat（src/engine/wechat），
 * juice 与 DOM 操作在 CLI 侧编排。
 */

import fs from 'node:fs'
import { createRequire } from 'node:module'
import { applyWeChatInlineFixups, ensureWeChatTextFontSize, extractCssCustomProperties, replaceCssVarFunctions, resolveCssCustomProperties, resolveMdFontSizeInInlineStyles } from './engine'
import juice from 'juice'
import type { RenderOptions } from './render'
import { buildThemeCss, renderBody } from './render'

const require = createRequire(import.meta.url)

export interface WeChatOptions extends RenderOptions {
  /** highlight.js 代码高亮主题名，默认 github-dark；传 none 关闭 */
  codeTheme?: string
}

/** 读取本地 highlight.js 样式，避免运行时联网 */
export function loadCodeThemeCss(name: string | undefined): string {
  const theme = name ?? `github-dark`
  if (theme === `none` || !theme)
    return ``
  try {
    const file = require.resolve(`highlight.js/styles/${theme}.css`)
    return fs.readFileSync(file, `utf8`)
  }
  catch {
    return ``
  }
}

function hoistNestedLists(html: string): string {
  const temp = document.createElement(`div`)
  temp.innerHTML = html
  temp.querySelectorAll(`li > ul, li > ol`).forEach((item) => {
    item.parentElement?.insertAdjacentElement(`afterend`, item)
  })
  return temp.innerHTML
}

function solveWeChatImage(root: HTMLElement): void {
  Array.from(root.getElementsByTagName(`img`)).forEach((image) => {
    const width = image.getAttribute(`width`)
    const height = image.getAttribute(`height`)
    if (width) {
      image.removeAttribute(`width`)
      image.style.width = /^\d+$/.test(width) ? `${width}px` : width
    }
    if (height) {
      image.removeAttribute(`height`)
      image.style.height = /^\d+$/.test(height) ? `${height}px` : height
    }
  })
}

/** Mermaid 节点标签兼容处理：把 <p> 包裹的 nodeLabel/edgeLabel 展平 */
function fixMermaidLabels(root: HTMLElement): void {
  root.querySelectorAll(`.nodeLabel`).forEach((node) => {
    const parent = node.parentElement
    if (!parent)
      return
    const xmlns = parent.getAttribute(`xmlns`)
    const style = parent.getAttribute(`style`)
    if (!xmlns || !style)
      return

    const section = document.createElement(`section`)
    section.setAttribute(`xmlns`, xmlns)
    section.setAttribute(`style`, style)
    section.innerHTML = parent.innerHTML

    const grand = parent.parentElement
    if (!grand)
      return
    grand.innerHTML = ``
    grand.appendChild(section)
  })
}

export function buildWeChatInlineHtml(markdown: string, options: WeChatOptions = {}): string {
  const body = renderBody(markdown)
  const themeCSS = buildThemeCss(options)
  const cssVars = resolveCssCustomProperties(extractCssCustomProperties(themeCSS))
  const codeCss = loadCodeThemeCss(options.codeTheme)
  const stylesToAdd = `<style>${themeCSS}</style>${codeCss ? `<style>${codeCss}</style>` : ``}`

  const combined = `${stylesToAdd}${body}`

  let html = juice(combined, {
    inlinePseudoElements: true,
    preserveImportant: true,
    resolveCSSVariables: false,
  })

  html = hoistNestedLists(html)
  html = resolveMdFontSizeInInlineStyles(html, options.fontSize ?? `16px`)
  html = applyWeChatInlineFixups(html, options.primaryColor ?? `#4876b8`)
  html = replaceCssVarFunctions(html, cssVars)

  const container = document.createElement(`div`)
  container.innerHTML = html
  container.querySelectorAll(`style, link[rel="stylesheet"]`).forEach(el => el.remove())

  solveWeChatImage(container)
  fixMermaidLabels(container)

  container.innerHTML = container.innerHTML.replace(
    /<tspan([^>]*)>/g,
    `<tspan$1 style="fill: #333333 !important; color: #333333 !important; stroke: none !important;">`,
  )

  ensureWeChatTextFontSize(container, options.fontSize ?? `16px`)

  return container.innerHTML
}

/** 由 HTML 提取纯文本，作为剪贴板兜底内容 */
export function htmlToPlainText(html: string): string {
  const container = document.createElement(`div`)
  container.innerHTML = html
  return (container.textContent ?? ``).trim()
}
