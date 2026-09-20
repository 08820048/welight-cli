/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * CSS 作用域包装器。
 * 给 CSS 选择器添加作用域前缀，限制样式只在预览区域生效。
 *
 * 这个文件会进入浏览器运行时，不能依赖 PostCSS，否则 Vite 会在客户端外置
 * source-map-js/url 等 Node 向模块并产生控制台 warning。
 */
import { SELECTOR_MAPPING } from './selectorMapping'

/**
 * 给 CSS 添加作用域前缀，并使用映射表转换旧选择器
 * @param css - 原始 CSS 字符串
 * @param scope - 作用域选择器，默认为 #output
 * @returns 添加作用域后的 CSS
 */
export function wrapCSSWithScope(css: string, scope: string = `#output`): string {
  return scopeCssRules(stripCssComments(css), scope)
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ``)
}

function scopeCssRules(css: string, scope: string): string {
  let output = ``
  let index = 0

  while (index < css.length) {
    const open = css.indexOf(`{`, index)
    if (open === -1) {
      output += css.slice(index)
      break
    }

    const selector = css.slice(index, open).trim()
    const close = findMatchingBrace(css, open)
    if (close === -1) {
      output += css.slice(index)
      break
    }

    const body = css.slice(open + 1, close)
    if (!selector) {
      output += css.slice(index, close + 1)
    }
    else if (selector.startsWith(`@`)) {
      output += wrapAtRule(selector, body, scope)
    }
    else {
      output += `${wrapSelectorList(selector, scope)} {${body}}`
    }

    index = close + 1
  }

  return output
}

function wrapAtRule(selector: string, body: string, scope: string): string {
  const normalized = selector.toLowerCase()
  if (normalized.includes(`keyframes`))
    return `${selector} {${body}}`
  if (body.includes(`{`))
    return `${selector} {${scopeCssRules(body, scope)}}`
  return `${selector} {${body}}`
}

function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0
  let quote: string | null = null

  for (let i = openIndex; i < css.length; i += 1) {
    const ch = css[i]
    const prev = css[i - 1]
    if (quote) {
      if (ch === quote && prev !== `\\`)
        quote = null
      continue
    }
    if (ch === `"` || ch === `'`) {
      quote = ch
      continue
    }
    if (ch === `{`) {
      depth += 1
      continue
    }
    if (ch === `}`) {
      depth -= 1
      if (depth === 0)
        return i
    }
  }

  return -1
}

function wrapSelectorList(selectorText: string, scope: string): string {
  return splitSelectorList(selectorText)
    .map(selector => wrapSelector(selector, scope))
    .filter(Boolean)
    .join(`,\n`)
}

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = []
  let current = ``
  let quote: string | null = null
  let parenDepth = 0
  let bracketDepth = 0

  for (const ch of selectorText) {
    if (quote) {
      current += ch
      if (ch === quote)
        quote = null
      continue
    }
    if (ch === `"` || ch === `'`) {
      quote = ch
      current += ch
      continue
    }
    if (ch === `(`)
      parenDepth += 1
    else if (ch === `)`)
      parenDepth = Math.max(0, parenDepth - 1)
    else if (ch === `[`)
      bracketDepth += 1
    else if (ch === `]`)
      bracketDepth = Math.max(0, bracketDepth - 1)

    if (ch === `,` && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(current)
      current = ``
      continue
    }

    current += ch
  }

  selectors.push(current)
  return selectors
}

function wrapSelector(selector: string, scope: string): string {
  let trimmed = selector.trim()
  if (!trimmed || trimmed.startsWith(scope) || trimmed.startsWith(`:root`))
    return trimmed

  if (trimmed.startsWith(`.dark `)) {
    const restSelector = trimmed.substring(6)
    return `.dark ${scope} ${restSelector}`
  }

  const baseSelector = trimmed.split(/[\s>+~:[]/, 1)[0].trim()
  if (baseSelector && SELECTOR_MAPPING[baseSelector])
    trimmed = trimmed.replace(baseSelector, `.${SELECTOR_MAPPING[baseSelector]}`)

  return `${scope} ${trimmed}`
}
