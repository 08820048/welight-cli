/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@62b9101c
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * CommonMark 的 emphasis flanking 规则会把 CJK 标点（。！？、等）当成 punctuation。
 * 于是 `**加粗。**下一句` 里的结束 `**` 不能闭合，加粗失效。
 * 公众号写作里这是常态，这里用成对 `**` 匹配覆盖默认规则。
 */
export function markedCjkEmphasis(): any {
  return {
    extensions: [
      {
        name: `cjk_strong`,
        level: `inline`,
        start(src: string) {
          const index = src.indexOf(`**`)
          return index < 0 ? undefined : index
        },
        tokenizer(this: any, src: string) {
          if (!src.startsWith(`**`) || src.startsWith(`***`))
            return undefined

          const match = /^\*\*((?:(?!\*\*)[^\n])+?)\*\*/.exec(src)
          if (!match)
            return undefined

          return {
            type: `strong`,
            raw: match[0],
            text: match[1],
            tokens: this.lexer.inlineTokens(match[1]),
          }
        },
      },
    ],
  }
}
