import process from 'node:process'
import type { Command } from 'commander'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { themeOptions } from '../engine'
import { Hint, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { c } from '../ui'

type ThemeList = typeof themeOptions

function View({ data }: { data: ThemeList }): ReactNode {
  return (
    <Box flexDirection="column">
      <Title subtitle={`共 ${data.length} 套（全部主题的前 45%）`}>可用免费主题</Title>
      <Box flexDirection="column">
        {data.map(theme => (
          <Box key={theme.value}>
            <Box width={7}>
              <Text color="cyan">{theme.value}</Text>
            </Box>
            <Box width={10}>
              <Text>{theme.label}</Text>
            </Box>
            <Text dimColor>{theme.desc}</Text>
          </Box>
        ))}
      </Box>
      <Hint>完整主题库请使用 Welight 桌面端。</Hint>
    </Box>
  )
}

export function registerThemes(program: Command): void {
  program
    .command(`themes`)
    .description(`列出 CLI 可用的免费主题`)
    .action(async () => {
      await executeCommand({
        run: async () => themeOptions,
        render: data => <View data={data} />,
        plain: (data) => {
          process.stdout.write(`可用免费主题（全部主题的前 45%）\n`)
          for (const theme of data)
            process.stdout.write(`  ${theme.value}  ${theme.label}  ${c.dim(theme.desc)}\n`)
          process.stdout.write(`\n${c.dim(`共 ${data.length} 套。完整主题库请使用 Welight 桌面端。`)}\n`)
        },
      })
    })
}
