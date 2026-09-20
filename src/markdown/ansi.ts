/**
 * Markdown → 终端 ANSI 文本（用于 stdout 输出，如 AI 回复）。
 * 使用 marked 的词法分析，避免引入额外的渲染依赖。
 */

import type { Token, Tokens } from 'marked'
import { marked } from 'marked'
import { c } from '../ui'

function inline(tokens: Token[] | undefined): string {
  if (!tokens || tokens.length === 0)
    return ``
  return tokens.map((token) => {
    switch (token.type) {
      case `strong`:
        return c.bold(inline((token as Tokens.Strong).tokens))
      case `em`:
        return c.italic(inline((token as Tokens.Em).tokens))
      case `del`:
        return c.strikethrough(inline((token as Tokens.Del).tokens))
      case `codespan`:
        return c.cyan((token as Tokens.Codespan).text)
      case `link`: {
        const link = token as Tokens.Link
        return `${inline(link.tokens)} ${c.dim(link.href)}`
      }
      case `image`: {
        const image = token as Tokens.Image
        return c.dim(`[图] ${image.text || image.href}`)
      }
      case `br`:
        return `\n`
      case `escape`:
        return (token as Tokens.Escape).text
      case `html`:
        return c.dim((token as Tokens.HTML).text)
      case `text`: {
        const text = token as Tokens.Text
        return text.tokens && text.tokens.length > 0 ? inline(text.tokens) : text.text
      }
      default:
        return (token as { raw?: string }).raw ?? ``
    }
  }).join(``)
}

function block(token: Token, indent = ``): string {
  switch (token.type) {
    case `heading`: {
      const heading = token as Tokens.Heading
      const text = inline(heading.tokens)
      if (heading.depth === 1)
        return c.bold(c.cyan(text))
      if (heading.depth === 2)
        return c.bold(text)
      return c.bold(c.dim(text))
    }
    case `paragraph`:
      return inline((token as Tokens.Paragraph).tokens)
    case `text`:
      return inline((token as Tokens.Text).tokens) || (token as Tokens.Text).text
    case `code`: {
      const code = token as Tokens.Code
      const lang = code.lang ? `${c.dim(`\`\`\`${code.lang}`)}\n` : ``
      const body = code.text.split(`\n`).map(line => `${indent}  ${c.dim(`│`)} ${line}`).join(`\n`)
      return `${lang}${body}`
    }
    case `blockquote`: {
      const quote = token as Tokens.Blockquote
      return blocks(quote.tokens, indent)
        .split(`\n`)
        .map(line => `${indent}${c.dim(`│`)} ${c.italic(line)}`)
        .join(`\n`)
    }
    case `list`: {
      const list = token as Tokens.List
      return list.items.map((item, index) => {
        const marker = list.ordered ? `${(Number(list.start) || 1) + index}.` : `•`
        const content = blocks(item.tokens, `${indent}   `)
        const [first, ...rest] = content.split(`\n`)
        return `${indent}${c.cyan(marker)} ${first}${rest.map(line => `\n${line}`).join(``)}`
      }).join(`\n`)
    }
    case `hr`:
      return `${indent}${c.dim(`─`.repeat(40))}`
    case `space`:
      return ``
    case `table`: {
      const table = token as Tokens.Table
      const head = table.header.map(cell => c.bold(inline(cell.tokens))).join(`  ${c.dim(`│`)}  `)
      const rows = table.rows.map(row => row.map(cell => inline(cell.tokens)).join(`  ${c.dim(`│`)}  `))
      return `${indent}${head}\n${indent}${c.dim(rows.map(() => `─`).join(``))}\n${rows.map(row => `${indent}${row}`).join(`\n`)}`
    }
    default:
      return `${indent}${(token as { raw?: string }).raw ?? ``}`
  }
}

function blocks(tokens: Token[], indent = ``): string {
  return tokens.map(token => block(token, indent)).filter(text => text !== ``).join(`\n\n`)
}

/** 把 Markdown 渲染为带 ANSI 样式的终端文本 */
export function markdownToAnsi(markdown: string): string {
  return blocks(marked.lexer(markdown)).trim()
}
