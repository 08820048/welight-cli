/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@62b9101c
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 微信公众号内联 HTML 处理工具（纯字符串/轻 DOM，可在浏览器与 Node 中复用）。
 *
 * 公众号编辑器不支持 CSS 变量与 <style>，粘贴前必须：
 * - 把主题 CSS 内联到元素（由调用方用 juice 完成）
 * - 解析并替换 var(--x) 函数
 * - 修正字号、节点标签等兼容性问题
 *
 * 本模块不依赖具体环境；DOM 相关函数只使用传入的 ParentNode。
 */

const WECHAT_TEXT_FONT_SELECTORS = `p, li, td, th, h1, h2, h3, h4, h5, h6`

function hasInlineFontSize(el: HTMLElement): boolean {
  if (el.style.fontSize)
    return true
  const style = el.getAttribute(`style`) || ``
  return /(?:^|;)\s*font-size\s*:/i.test(style)
}

/**
 * 公众号保存时会给没有内联 font-size 的正文标签补上默认 17px。
 * 主题若只把字号写在容器上，粘贴预览看起来正常，一保存就会被撑大。
 */
export function ensureWeChatTextFontSize(root: ParentNode, mdFontSize: string): void {
  const size = mdFontSize.trim()
  if (!size)
    return

  root.querySelectorAll<HTMLElement>(WECHAT_TEXT_FONT_SELECTORS).forEach((el) => {
    if (hasInlineFontSize(el))
      return
    el.style.fontSize = size
  })
}

export function resolveMdFontSizeInInlineStyles(html: string, mdFontSize: string): string {
  const size = mdFontSize.trim()
  if (!size)
    return html

  const sizeMatch = /^(\d+(?:\.\d+)?)([a-z%]+)$/i.exec(size)
  if (!sizeMatch)
    return html.replace(/var\(--md-font-size\)/g, size)

  const baseValue = Number.parseFloat(sizeMatch[1])
  const unit = sizeMatch[2]
  if (!Number.isFinite(baseValue) || baseValue <= 0)
    return html.replace(/var\(--md-font-size\)/g, size)

  const calcRe = /calc\(\s*var\(--md-font-size\)\s*\*\s*(\d+(?:\.\d+)?)\s*\)/gi
  let next = html.replace(calcRe, (_, k1: string) => {
    const factor = Number.parseFloat(k1)
    if (!Number.isFinite(factor))
      return `calc(${size} * ${k1})`
    const computed = Number((baseValue * factor).toFixed(3))
    return `${computed}${unit}`
  })

  next = next.replace(/var\(--md-font-size\)/g, size)
  return next
}

export function extractCssCustomProperties(cssText: string): Record<string, string> {
  const map: Record<string, string> = {}
  const len = cssText.length
  const isNameChar = (ch: string) => /[\w-]/.test(ch)

  let i = 0
  while (i < len) {
    const start = cssText.indexOf(`--`, i)
    if (start < 0)
      break

    let j = start + 2
    while (j < len && isNameChar(cssText[j]!))
      j += 1

    const name = cssText.slice(start, j).trim()
    if (!name) {
      i = j
      continue
    }

    let k = j
    while (k < len && /\s/.test(cssText[k]!))
      k += 1
    if (cssText[k] !== `:`) {
      i = j
      continue
    }

    k += 1
    while (k < len && /\s/.test(cssText[k]!))
      k += 1

    const valueStart = k
    let quote: string | null = null
    let parenDepth = 0
    while (k < len) {
      const ch = cssText[k]!
      if (quote) {
        if (ch === quote && cssText[k - 1] !== `\\`)
          quote = null
        k += 1
        continue
      }

      if (ch === `"` || ch === `'`) {
        quote = ch
        k += 1
        continue
      }

      if (ch === `(`) {
        parenDepth += 1
        k += 1
        continue
      }

      if (ch === `)` && parenDepth > 0) {
        parenDepth -= 1
        k += 1
        continue
      }

      if (ch === `;` && parenDepth === 0)
        break

      k += 1
    }

    const value = cssText.slice(valueStart, k).trim()
    if (value && cssText[k] === `;`)
      map[name] = value

    i = k + 1
  }

  return map
}

export function resolveCssCustomProperties(map: Record<string, string>): Record<string, string> {
  const resolving = new Set<string>()
  const resolved: Record<string, string> = {}

  const resolveVar = (name: string) => {
    if (!name || resolved[name])
      return
    if (resolving.has(name))
      return
    const raw = map[name]
    if (!raw)
      return

    resolving.add(name)
    const next = replaceCssVarFunctionsBy(raw.trim(), (varName, fallback, full) => {
      const vn = String(varName || '').trim()
      if (!vn.startsWith(`--`))
        return fallback || full
      if (vn === name)
        return fallback || full

      if (resolved[vn])
        return resolved[vn]

      if (map[vn] && !resolving.has(vn)) {
        resolveVar(vn)
        if (resolved[vn])
          return resolved[vn]
      }

      return fallback || full
    })
    resolving.delete(name)
    resolved[name] = next
  }

  Object.keys(map).forEach(resolveVar)

  return resolved
}

export function replaceCssVarFunctionsBy(
  html: string,
  resolver: (varName: string, fallback: string, full: string) => string,
): string {
  const input = String(html)
  const len = input.length
  let out = ``
  let i = 0

  while (i < len) {
    const idx = input.indexOf(`var(`, i)
    if (idx < 0) {
      out += input.slice(i)
      break
    }

    out += input.slice(i, idx)

    let j = idx + 4
    let depth = 1
    let quote: string | null = null
    while (j < len) {
      const ch = input[j]!
      if (quote) {
        if (ch === quote && input[j - 1] !== `\\`)
          quote = null
        j += 1
        continue
      }

      if (ch === `"` || ch === `'`) {
        quote = ch
        j += 1
        continue
      }

      if (ch === `(`) {
        depth += 1
        j += 1
        continue
      }

      if (ch === `)`) {
        depth -= 1
        if (depth === 0)
          break
        j += 1
        continue
      }

      j += 1
    }

    if (j >= len || input[j] !== `)`) {
      out += input.slice(idx)
      break
    }

    const full = input.slice(idx, j + 1)
    const content = input.slice(idx + 4, j)

    let commaIndex = -1
    let innerDepth = 0
    let innerQuote: string | null = null
    for (let p = 0; p < content.length; p += 1) {
      const ch = content[p]!
      if (innerQuote) {
        if (ch === innerQuote && content[p - 1] !== `\\`)
          innerQuote = null
        continue
      }
      if (ch === `"` || ch === `'`) {
        innerQuote = ch
        continue
      }
      if (ch === `(`) {
        innerDepth += 1
        continue
      }
      if (ch === `)` && innerDepth > 0) {
        innerDepth -= 1
        continue
      }
      if (ch === `,` && innerDepth === 0) {
        commaIndex = p
        break
      }
    }

    const varName = (commaIndex >= 0 ? content.slice(0, commaIndex) : content).trim()
    const fallback = (commaIndex >= 0 ? content.slice(commaIndex + 1) : ``).trim()

    out += resolver(varName, fallback, full)

    i = j + 1
  }

  return out
}

export function replaceCssVarFunctions(html: string, variables: Record<string, string>): string {
  if (!html || !Object.keys(variables).length)
    return html

  return replaceCssVarFunctionsBy(html, (varName, fallback, full) => {
    const vn = String(varName || '').trim()
    if (!vn.startsWith(`--`))
      return fallback || full
    return variables[vn] || fallback || full
  })
}

/**
 * 公众号粘贴前的兼容性替换：
 * 与桌面端 generateWeChatInlineHtml / processClipboardContent 完全一致。
 */
export function applyWeChatInlineFixups(html: string, primaryColor: string): string {
  return html
    .replace(/([^-])top:(.*?)em/g, `$1transform: translateY($2em)`)
    .replace(/hsl\(var\(--foreground\)\)/g, `#3f3f3f`)
    .replace(/var\(--blockquote-background\)/g, `#f7f7f7`)
    .replace(/var\(--md-primary-color\)/g, primaryColor)
    .replace(/--md-primary-color:.+?;/g, ``)
    .replace(/--md-font-family:.+?;/g, ``)
    .replace(/--md-font-size:.+?;/g, ``)
    .replace(
      /<span class="nodeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g,
      `<span class="nodeLabel"$1>$2</span>`,
    )
    .replace(
      /<span class="edgeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g,
      `<span class="edgeLabel"$1>$2</span>`,
    )
}
