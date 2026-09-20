/**
 * Ink 版 Markdown 渲染（用于对话记录等 TUI 场景）。
 */

import type { Token, Tokens } from 'marked'
import type { ReactNode } from 'react'
import { marked } from 'marked'
import { Box, Text } from 'ink'

function Inline({ tokens }: { tokens: Token[] | undefined }): ReactNode {
  if (!tokens || tokens.length === 0)
    return null
  return (
    <>
      {tokens.map((token, index) => {
        const key = index
        switch (token.type) {
          case `strong`:
            return <Text key={key} bold><Inline tokens={(token as Tokens.Strong).tokens} /></Text>
          case `em`:
            return <Text key={key} italic><Inline tokens={(token as Tokens.Em).tokens} /></Text>
          case `del`:
            return <Text key={key} strikethrough><Inline tokens={(token as Tokens.Del).tokens} /></Text>
          case `codespan`:
            return <Text key={key} color="cyan">{(token as Tokens.Codespan).text}</Text>
          case `link`: {
            const link = token as Tokens.Link
            return <Text key={key}><Inline tokens={link.tokens} /><Text dimColor>{` ${link.href}`}</Text></Text>
          }
          case `image`: {
            const image = token as Tokens.Image
            return <Text key={key} dimColor>{`[图] ${image.text || image.href}`}</Text>
          }
          case `br`:
            return <Text key={key}>{`\n`}</Text>
          case `text`: {
            const text = token as Tokens.Text
            return text.tokens && text.tokens.length > 0
              ? <Inline key={key} tokens={text.tokens} />
              : <Text key={key}>{text.text}</Text>
          }
          default:
            return <Text key={key}>{(token as { raw?: string }).raw ?? ``}</Text>
        }
      })}
    </>
  )
}

function Block({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case `heading`: {
      const heading = token as Tokens.Heading
      return <Text bold color={heading.depth === 1 ? `cyan` : undefined} wrap="wrap"><Inline tokens={heading.tokens} /></Text>
    }
    case `paragraph`:
      return <Text wrap="wrap"><Inline tokens={(token as Tokens.Paragraph).tokens} /></Text>
    case `text`:
      return <Text wrap="wrap"><Inline tokens={(token as Tokens.Text).tokens} /></Text>
    case `code`:
      return (
        <Box flexDirection="column" marginLeft={2}>
          {(token as Tokens.Code).text.split(`\n`).map((line, index) => (
            <Text key={index} dimColor>{`│ ${line}`}</Text>
          ))}
        </Box>
      )
    case `blockquote`: {
      const quote = token as Tokens.Blockquote
      return (
        <Box flexDirection="column" marginLeft={1}>
          {quote.tokens.map((child, index) => (
            <Box key={index}>
              <Text dimColor>{`│ `}</Text>
              <Block token={child} />
            </Box>
          ))}
        </Box>
      )
    }
    case `list`: {
      const list = token as Tokens.List
      return (
        <Box flexDirection="column">
          {list.items.map((item, index) => (
            <Box key={index}>
              <Text color="cyan">{list.ordered ? `${(Number(list.start) || 1) + index}. ` : `• `}</Text>
              <Box flexDirection="column">
                {item.tokens.map((child, childIndex) => <Block key={childIndex} token={child} />)}
              </Box>
            </Box>
          ))}
        </Box>
      )
    }
    case `hr`:
      return <Text dimColor>{`─`.repeat(40)}</Text>
    case `space`:
      return null
    case `table`: {
      const table = token as Tokens.Table
      return (
        <Box flexDirection="column">
          <Text bold>{table.header.map(cell => inlineText(cell.tokens)).join(`  │  `)}</Text>
          {table.rows.map((row, index) => (
            <Text key={index}>{row.map(cell => inlineText(cell.tokens)).join(`  │  `)}</Text>
          ))}
        </Box>
      )
    }
    default:
      return <Text wrap="wrap">{(token as { raw?: string }).raw ?? ``}</Text>
  }
}

/** 表格单元格用纯文本（保留强调符号的简化版） */
function inlineText(tokens: Token[] | undefined): string {
  if (!tokens)
    return ``
  return tokens.map((token) => {
    if (token.type === `strong`)
      return inlineText((token as Tokens.Strong).tokens)
    if (token.type === `em`)
      return inlineText((token as Tokens.Em).tokens)
    if (token.type === `codespan`)
      return (token as Tokens.Codespan).text
    if (token.type === `text`)
      return (token as Tokens.Text).tokens ? inlineText((token as Tokens.Text).tokens) : (token as Tokens.Text).text
    if (token.type === `link`)
      return inlineText((token as Tokens.Link).tokens)
    return (token as { raw?: string }).raw ?? ``
  }).join(``)
}

export function Markdown({ source }: { source: string }): ReactNode {
  const tokens = marked.lexer(source)
  return (
    <Box flexDirection="column">
      {tokens.map((token, index) => <Block key={index} token={token} />)}
    </Box>
  )
}
