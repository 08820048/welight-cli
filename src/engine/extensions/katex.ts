/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@d9c82255
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * KaTeX/LaTeX 扩展适配器
 * 返回符合 marked 扩展形状的对象，但不显式依赖 marked 的类型定义，
 * 以避免多版本 marked 在工作区中的类型冲突。
 */

export interface MarkedKatexOptions {
  nonStandard?: boolean
}

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:？！。，：]|$)/
const inlineRuleNonStandard = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1/ // Non-standard, even if there are no spaces before and after $ or $$, try to parse

const blockRule = /^\s{0,3}(\${1,2})[ \t]*\n([\s\S]+?)\n\s{0,3}\1[ \t]*(?:\n|$)/

// LaTeX style rules for \( ... \) and \[ ... \]
const inlineLatexRule = /^\\\(([^\\]*(?:\\.[^\\]*)*?)\\\)/
const blockLatexRule = /^\\\[([^\\]*(?:\\.[^\\]*)*?)\\\]/

function removeEmptySvgDimensions(root: SVGElement) {
  const svgs = [root, ...Array.from(root.querySelectorAll(`svg`))]
  svgs.forEach((svg) => {
    if (!svg.getAttribute(`width`)?.trim())
      svg.removeAttribute(`width`)
    if (!svg.getAttribute(`height`)?.trim())
      svg.removeAttribute(`height`)
  })
}

function createRenderer(display: boolean, withStyle: boolean = true) {
  return (token: any) => {
    try {
      const mj: any = (window as any).MathJax
      if (mj && typeof mj.tex2svg === `function`) {
        if (typeof mj.texReset === `function`)
          mj.texReset()
        const mjxContainer = mj.tex2svg(token.text, { display })
        const svg = mjxContainer.firstChild as SVGElement
        const width = svg.style.getPropertyValue(`min-width`) || svg.getAttribute(`width`)
        svg.removeAttribute(`width`)
        removeEmptySvgDimensions(svg)
        if (withStyle) {
          svg.style.display = `initial`
          svg.style.setProperty(`max-width`, `300vw`, `important`)
          svg.style.flexShrink = `0`
          if (width)
            svg.style.width = width
        }
        if (!display)
          return `<span class="katex-inline">${svg.outerHTML}</span>`
        return `<section class="katex-block">${svg.outerHTML}</section>`
      }
    }
    catch {}
    const escaped = token.text
      .replace(/&/g, `&amp;`)
      .replace(/</g, `&lt;`)
      .replace(/>/g, `&gt;`)
      .replace(/"/g, `&quot;`)
      .replace(/'/g, `&#39;`)
      .replace(/`/g, `&#96;`)
    return display
      ? `<section class="katex-block">${escaped}</section>`
      : `<span class="katex-inline">${escaped}</span>`
  }
}

function inlineKatex(options: MarkedKatexOptions | undefined, renderer: any) {
  const nonStandard = options && options.nonStandard
  const ruleReg = nonStandard ? inlineRuleNonStandard : inlineRule
  return {
    name: `inlineKatex`,
    level: `inline`,
    start(src: string) {
      let index
      let indexSrc = src

      while (indexSrc) {
        index = indexSrc.indexOf(`$`)
        if (index === -1) {
          return
        }
        const f = nonStandard ? index > -1 : index === 0 || indexSrc.charAt(index - 1) === ` `
        if (f) {
          const possibleKatex = indexSrc.substring(index)

          if (possibleKatex.match(ruleReg)) {
            return index
          }
        }

        indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, ``)
      }
    },
    tokenizer(src: string) {
      const match = src.match(ruleReg)
      if (match) {
        return {
          type: `inlineKatex`,
          raw: match[0],
          text: match[2].trim(),
          displayMode: match[1].length === 2,
        }
      }
    },
    renderer,
  }
}

function blockKatex(_options: MarkedKatexOptions | undefined, renderer: any) {
  return {
    name: `blockKatex`,
    level: `block`,
    tokenizer(src: string) {
      const match = src.match(blockRule)
      if (match) {
        return {
          type: `blockKatex`,
          raw: match[0],
          text: match[2].trim(),
          displayMode: match[1].length === 2,
        }
      }
    },
    renderer,
  }
}

function inlineLatexKatex(_options: MarkedKatexOptions | undefined, renderer: any) {
  return {
    name: `inlineLatexKatex`,
    level: `inline`,
    start(src: string) {
      const index = src.indexOf(`\\(`)
      return index !== -1 ? index : undefined
    },
    tokenizer(src: string) {
      const match = src.match(inlineLatexRule)
      if (match) {
        return {
          type: `inlineLatexKatex`,
          raw: match[0],
          text: match[1].trim(),
          displayMode: false,
        }
      }
    },
    renderer,
  }
}

function blockLatexKatex(_options: MarkedKatexOptions | undefined, renderer: any) {
  return {
    name: `blockLatexKatex`,
    level: `block`,
    start(src: string) {
      const index = src.indexOf(`\\[`)
      return index !== -1 ? index : undefined
    },
    tokenizer(src: string) {
      const match = src.match(blockLatexRule)
      if (match) {
        return {
          type: `blockLatexKatex`,
          raw: match[0],
          text: match[1].trim(),
          displayMode: true,
        }
      }
    },
    renderer,
  }
}

/**
 * 生成 KaTeX 扩展
 * @param options 扩展选项
 * @param withStyle 是否应用内联样式（新主题系统默认 true）
 */
export function MDKatex(options: MarkedKatexOptions | undefined, withStyle: boolean = true): any {
  return {
    extensions: [
      inlineKatex(options, createRenderer(false, withStyle)),
      blockKatex(options, createRenderer(true, withStyle)),
      inlineLatexKatex(options, createRenderer(false, withStyle)),
      blockLatexKatex(options, createRenderer(true, withStyle)),
    ],
  }
}
