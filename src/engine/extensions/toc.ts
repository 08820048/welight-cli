/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@bd850083
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 目录 [TOC] 扩展
 * 返回符合 marked 扩展形状的对象，但不显式依赖 marked 的类型定义，
 * 以避免多版本 marked 在工作区中的类型冲突。
 */

/**
 * marked 插件：支持 [TOC] 语法，自动生成嵌套目录
 */
/**
 * 生成目录扩展
 */
export function markedToc(): any {
  let headings: { text: string, depth: number, index: number }[] = []

  let firstToken = true

  return {
    walkTokens(token: any) {
      if (firstToken) {
        headings = []
        firstToken = false
      }
      if (token.type === `heading`) {
        const text = token.text || ``
        const depth = token.depth || 1
        const index = headings.length
        headings.push({ text, depth, index })
      }
    },
    extensions: [
      {
        name: `toc`,
        level: `block`,
        start(src: string) {
          // 只匹配独立一行的 [TOC]，避免误伤
          const match = src.match(/^\s*\[TOC\]\s*$/m)
          return match ? match.index : undefined
        },
        tokenizer(src: string) {
          const match = /^\[TOC\]/.exec(src)
          if (match) {
            return {
              type: `toc`,
              raw: match[0],
            }
          }
        },
        renderer() {
          if (!headings.length)
            return ``
          let html = `<nav class="markdown-toc"><ul class="toc-ul toc-level-1 pl-4 border-l ml-2">`
          let lastDepth = 1
          headings.forEach(({ text, depth, index }) => {
            if (depth > lastDepth) {
              for (let i = lastDepth + 1; i <= depth; i++) {
                html += `<ul class="toc-ul toc-level-${i} pl-4 border-l ml-2">`
              }
            }
            else if (depth < lastDepth) {
              for (let i = lastDepth; i > depth; i--) {
                html += `</ul>`
              }
            }
            html += `<li class="toc-li toc-level-${depth} mb-1"><a class="text-gray-700 hover:text-blue-600 underline transition-colors" href="#${index}">${text}</a></li>`
            lastDepth = depth
          })

          for (let i = lastDepth; i > 1; i--) {
            html += `</ul>`
          }

          html += `</ul></nav>`

          firstToken = true
          return html
        },
      },
    ],
  }
}
