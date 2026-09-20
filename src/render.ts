/**
 * 渲染管线：复用从 GUI 仓库导出的内核（src/engine）。
 *
 * 流程与桌面端一致：
 *   markdown -> initRenderer 注册的 marked 扩展 -> renderMarkdown
 *   -> postProcessHtml（脚注 / 阅读时间 / 消毒 / 容器）
 *   -> 叠加主题 CSS（CSS 变量 + base + 主题 + 自定义）
 */

import {
  baseCSSContent,
  generateCSSVariables,
  initRenderer,
  postProcessHtml,
  renderMarkdown,
  themeMap,
  wrapCSSWithScope,
  type ThemeName,
} from './engine'
import { DEFAULT_CONFIG } from './config'

export interface RenderOptions {
  theme?: string
  primaryColor?: string
  fontFamily?: string
  fontSize?: string
  customCSS?: string
  /** 输出完整 HTML 文档（true）还是仅正文片段（false） */
  document?: boolean
  title?: string
}

export function isFreeTheme(name: string): name is ThemeName {
  return Object.prototype.hasOwnProperty.call(themeMap, name)
}

export function assertFreeTheme(name: string): ThemeName {
  if (!isFreeTheme(name)) {
    const available = Object.keys(themeMap).join(`, `)
    throw new Error(`主题 "${name}" 不可用。CLI 只提供免费主题：${available}`)
  }
  return name
}

/** 组合主题 CSS（未限定作用域） */
export function buildThemeCss(options: RenderOptions = {}): string {
  const theme = assertFreeTheme(options.theme ?? DEFAULT_CONFIG.theme)
  const variables = generateCSSVariables({
    primaryColor: options.primaryColor ?? DEFAULT_CONFIG.primaryColor,
    // 双引号会在内联到 style="..." 时破坏属性，统一降级为单引号
    fontFamily: (options.fontFamily ?? DEFAULT_CONFIG.fontFamily).replace(/"/g, `'`),
    fontSize: options.fontSize ?? DEFAULT_CONFIG.fontSize,
  })
  const themeCSS = themeMap[theme] ?? ``
  return [variables, baseCSSContent, themeCSS, options.customCSS ?? ``].filter(Boolean).join(`\n`)
}

/** 渲染正文片段（`<section class="container md-container">...`），与桌面端预览一致 */
export function renderBody(markdown: string): string {
  const renderer = initRenderer({
    isMacCodeBlock: true,
    isShowLineNumber: false,
    openLinksInNewTab: false,
  })
  const { html, readingTime } = renderMarkdown(markdown, renderer)
  return postProcessHtml(html, readingTime, renderer)
}

/** 渲染为独立 HTML 文档，主题 CSS 作用域限定在 #output */
export function renderDocument(markdown: string, options: RenderOptions = {}): string {
  const body = renderBody(markdown)
  const themeCSS = buildThemeCss(options)
  const scopedTheme = wrapCSSWithScope(themeCSS, `#output`)
  const title = options.title ?? `Welight`
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${scopedTheme}
</style>
</head>
<body>
<div id="output">
${body}
</div>
</body>
</html>
`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, `&amp;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(/"/g, `&quot;`)
}
