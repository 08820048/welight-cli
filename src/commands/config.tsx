import process from 'node:process'
import type { Command } from 'commander'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { WelightConfig } from '../config'
import { loadWelightConfig } from '../config'
import { Hint, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { c } from '../ui'

interface ConfigData {
  configFile?: string
  config: WelightConfig
}

function View({ data }: { data: ConfigData }): ReactNode {
  return (
    <Box flexDirection="column">
      <Title subtitle={data.configFile ?? `未创建（可运行 welight init）`}>当前配置</Title>
      <Box flexDirection="column">
        {JSON.stringify(data.config, null, 2).split(`\n`).map((line, index) => (
          <Text key={index} dimColor>{line}</Text>
        ))}
      </Box>
      <Hint>命令行参数与环境变量不在此展示。</Hint>
    </Box>
  )
}

export function registerConfig(program: Command): void {
  program
    .command(`config`)
    .description(`打印解析后的配置与来源文件`)
    .action(async () => {
      await executeCommand({
        run: async () => loadWelightConfig(),
        render: data => <View data={data} />,
        plain: (data) => {
          process.stdout.write(`${c.bold(`配置文件：`)}${data.configFile ?? c.dim(`未创建（可运行 welight init）`)}\n\n`)
          process.stdout.write(`${JSON.stringify(data.config, null, 2)}\n`)
        },
      })
    })
}
