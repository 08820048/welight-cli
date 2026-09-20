/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@bd850083
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * CSS 变量生成工具
 * 根据配置动态生成 CSS 变量样式
 */

export interface CSSVariableConfig {
  primaryColor: string
  fontFamily: string
  fontSize: string
  paragraphLineHeight?: string
  paragraphLetterSpacing?: string
  unorderedListStyle?: string
  isUseIndent?: boolean
  isUseJustify?: boolean
  headingAlign?: '' | 'left' | 'center' | 'right'
}

function parseCssColorToRgbTriplet(color: string): string | null {
  const raw = String(color || ``).trim()
  if (!raw)
    return null

  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex.split(``).map(ch => ch + ch).join(``)
    }
    if (hex.length === 8) {
      hex = hex.slice(0, 6)
    }
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b))
      return `${r}, ${g}, ${b}`
    return null
  }

  const rgbMatch = raw.match(/^rgba?\(([^)]*)\)$/i)
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(/\s*,\s*/)
      .map(s => s.trim())
      .filter(Boolean)
    if (parts.length >= 3) {
      const r = Number(parts[0])
      const g = Number(parts[1])
      const b = Number(parts[2])
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b))
        return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`
    }
  }

  return null
}

/**
 * 生成 CSS 变量样式（仅包含 :root 变量）
 * @param config - 配置对象
 * @returns CSS 变量字符串
 */
export function generateCSSVariables(config: CSSVariableConfig): string {
  const extraVariables: string[] = []

  if (config.paragraphLineHeight) {
    extraVariables.push(`  --md-paragraph-line-height: ${config.paragraphLineHeight};`)
  }

  if (config.paragraphLetterSpacing) {
    extraVariables.push(`  --md-paragraph-letter-spacing: ${config.paragraphLetterSpacing};`)
  }

  return `
:root {
  /* 动态配置变量 */
  --md-primary-color: ${config.primaryColor};
  --md-font-family: ${config.fontFamily};
  --md-font-size: ${config.fontSize};
${extraVariables.join(`\n`)}
}
  `.trim()
}

export function generatePreviewScopedVariableOverrides(config: CSSVariableConfig, scope: string = `#output`): string {
  const variableLines: string[] = [
    `  --md-primary-color: ${config.primaryColor};`,
    `  --md-primary: ${config.primaryColor};`,
    `  --md-font-family: ${config.fontFamily};`,
    `  --md-font-size: ${config.fontSize};`,
  ]

  const rgbTriplet = parseCssColorToRgbTriplet(config.primaryColor)
  if (rgbTriplet) {
    variableLines.push(`  --md-primary-rgb: ${rgbTriplet};`)
  }

  if (config.paragraphLineHeight) {
    variableLines.push(`  --md-paragraph-line-height: ${config.paragraphLineHeight};`)
  }

  if (config.paragraphLetterSpacing) {
    variableLines.push(`  --md-paragraph-letter-spacing: ${config.paragraphLetterSpacing};`)
  }

  return `
${scope},
.dark ${scope} {
${variableLines.join(`\n`)}
}
  `.trim()
}

/**
 * 生成段落缩进和对齐样式
 * 需要放在主题 CSS 之后加载，以确保覆盖主题中的段落样式
 * @param config - 配置对象
 * @returns 段落样式字符串
 */
export function generateParagraphStyles(config: CSSVariableConfig): string {
  const paragraphOnlyStyles: string[] = []
  const paragraphAndListItemStyles: string[] = []
  const listStyles: string[] = []

  if (config.isUseIndent) {
    paragraphOnlyStyles.push(`text-indent: 2em;`)
  }

  if (config.isUseJustify) {
    paragraphOnlyStyles.push(`text-align: justify;`)
  }

  if (config.paragraphLineHeight) {
    paragraphAndListItemStyles.push(`line-height: ${config.paragraphLineHeight};`)
  }

  if (config.paragraphLetterSpacing) {
    paragraphAndListItemStyles.push(`letter-spacing: ${config.paragraphLetterSpacing};`)
  }

  if (config.unorderedListStyle) {
    listStyles.push(`list-style-type: ${config.unorderedListStyle};`)
  }

  if (paragraphOnlyStyles.length === 0 && paragraphAndListItemStyles.length === 0 && listStyles.length === 0) {
    return ``
  }

  const cssBlocks: string[] = []

  if (paragraphOnlyStyles.length > 0) {
    cssBlocks.push(`
#output p {
  ${paragraphOnlyStyles.join(`\n  `)}
}
    `.trim())
  }

  if (paragraphAndListItemStyles.length > 0) {
    cssBlocks.push(`
#output p,
#output li {
  ${paragraphAndListItemStyles.join(`\n  `)}
}
    `.trim())
  }

  if (listStyles.length > 0) {
    cssBlocks.push(`
#output ul {
  ${listStyles.join(`\n  `)}
}
    `.trim())
  }

  return cssBlocks.join(`\n\n`)
}

export function generateHeadingStyles(config: CSSVariableConfig): string {
  const align = config.headingAlign
  if (align !== 'left' && align !== 'center' && align !== 'right')
    return ``

  const styles: string[] = [`text-align: ${align} !important;`]

  if (align === 'left') {
    styles.push(`margin-left: 0 !important;`)
    styles.push(`margin-right: auto !important;`)
  }
  else if (align === 'center') {
    styles.push(`margin-left: auto !important;`)
    styles.push(`margin-right: auto !important;`)
  }
  else {
    styles.push(`margin-left: auto !important;`)
    styles.push(`margin-right: 0 !important;`)
  }

  return `
#output h1,
#output h2,
#output h3 {
  ${styles.join(`\n  `)}
}
  `.trim()
}

/**
 * 生成字体与字号覆盖样式
 * - 用于覆盖主题中可能写死的 `.md-container { font-family/font-size }` 等规则
 * - 确保面板里的「字体/字号」设置始终对预览区生效
 * @param scope - 预览作用域选择器，默认 `#output`
 */
export function generateTypographyOverrideStyles(scope: string = `#output`): string {
  return `
${scope},
${scope} section,
${scope} container,
${scope} .md-container,
${scope} .container {
  font-family: var(--md-font-family) !important;
  font-size: var(--md-font-size) !important;
}
  `.trim()
}
