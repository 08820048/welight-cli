/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@ec6dd620
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 脚注扩展
 * 返回符合 marked 扩展形状的对象，但不显式依赖 marked 的类型定义，
 * 以避免多版本 marked 在工作区中的类型冲突。
 */
/**
 * A marked extension to support footnotes syntax.
 * Syntax:
 *  This is a footnote reference[^1][^2].
 *
 *  [^1]: .....
 *  [^2]: .....
 */

interface MapContent {
  index: number
  text: string
}
const fnMap = new Map<string, MapContent>()

/**
 * 生成脚注扩展
 */
export function markedFootnotes(): any {
  return {
    extensions: [
      {
        name: `footnoteDef`,
        level: `block`,
        start(src: string) {
          fnMap.clear()
          return src.match(/^\[\^/)?.index
        },
        tokenizer(src: string) {
          const match = src.match(/^\[\^(.*)\]:(.*)/)
          if (match) {
            const [raw, fnId, text] = match
            const index = fnMap.size + 1
            fnMap.set(fnId, { index, text })
            return {
              type: `footnoteDef`,
              raw,
              fnId,
              index,
              text,
            }
          }
          return undefined
        },
        renderer(token: any) {
          const { index, text, fnId } = token
          const fnInner = `
                <code>${index}.</code> 
                <span>${text}</span> 
                    <a id="fnDef-${fnId}" href="#fnRef-${fnId}" style="color: var(--md-primary-color);">\u21A9\uFE0E</a>
                <br>`
          if (index === 1) {
            return `
            <p style="font-size: 80%;margin: 0.5em 8px;word-break:break-all;">${fnInner}`
          }
          if (index === fnMap.size) {
            return `${fnInner}</p>`
          }
          return fnInner
        },
      },
      {
        name: `footnoteRef`,
        level: `inline`,
        start(src: string) {
          return src.match(/\[\^/)?.index
        },
        tokenizer(src: string) {
          const match = src.match(/^\[\^(.*?)\]/)
          if (match) {
            const [raw, fnId] = match
            if (fnMap.has(fnId)) {
              return {
                type: `footnoteRef`,
                raw,
                fnId,
              }
            }
          }
        },
        renderer(token: any) {
          const { fnId } = token
          const { index } = fnMap.get(fnId) as MapContent
          return `<sup style="color: var(--md-primary-color);">
                    <a href="#fnDef-${fnId}" id="fnRef-${fnId}">\[${index}\]</a>
                </sup>`
        },
      },
    ],
  }
}
