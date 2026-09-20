/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * CSS 运行时处理工具。
 *
 * 这里运行在浏览器/WebView 里，不能直接依赖 PostCSS。PostCSS 会拉入
 * source-map-js、url 等 Node 向模块，Vite 会将它们 externalize，导致控制台
 * 持续出现 browser compatibility warning。
 */

/**
 * @param css - 原始 CSS 字符串
 * @returns 处理后的 CSS 字符串
 */
export async function processCSS(css: string): Promise<string> {
  return simplifyLiteralCalc(css)
}

function simplifyLiteralCalc(css: string): string {
  return css.replace(/calc\(([^()]*)\)/gi, (match, expression: string) => {
    const simplified = trySimplifyBinaryCalc(expression)
    return simplified ?? match
  })
}

function trySimplifyBinaryCalc(expression: string): string | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 3)
    return null

  const [left, operator, right] = parts
  if (operator !== `+` && operator !== `-`)
    return null

  const lhs = parseCssNumber(left)
  const rhs = parseCssNumber(right)
  if (!lhs || !rhs || lhs.unit !== rhs.unit)
    return null

  const value = operator === `+` ? lhs.value + rhs.value : lhs.value - rhs.value
  return `${Number(value.toFixed(6))}${lhs.unit}`
}

function parseCssNumber(raw: string | undefined): { value: number, unit: string } | null {
  const match = /^(-?\d+(?:\.\d+)?)([a-z%]*)$/i.exec(raw ?? ``)
  if (!match)
    return null
  const value = Number(match[1])
  if (!Number.isFinite(value))
    return null
  return { value, unit: match[2] ?? `` }
}
