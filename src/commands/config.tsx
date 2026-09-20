import process from 'node:process'
import type { Command } from 'commander'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { CONFIG_PATHS, getConfigValue, loadWelightConfig, setConfigValue, unsetConfigValue } from '../config'
import type { WelightConfig } from '../config'
import { Hint, KeyValueList, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { c, ui } from '../ui'

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
      <Hint>{`可修改项：${CONFIG_PATHS.join(`, `)}`}</Hint>
    </Box>
  )
}

export function registerConfig(program: Command): void {
  const config = program
    .command(`config`)
    .description(`查看或修改 welight.config.json`)
    .addHelpText(`after`, `\n可修改项（config set/unset）：\n  ${CONFIG_PATHS.join(`\n  `)}\n\n示例:\n  $ welight config set theme w011\n  $ welight config set model.baseUrl https://api.deepseek.com/v1\n  $ welight config get theme\n  $ welight config unset theme`)

  config.action(async () => {
    await executeCommand<ConfigData>({
      run: async () => loadWelightConfig(),
      render: data => <View data={data} />,
      plain: (data) => {
        process.stdout.write(`${c.bold(`配置文件：`)}${data.configFile ?? c.dim(`未创建（可运行 welight init）`)}\n\n`)
        process.stdout.write(`${JSON.stringify(data.config, null, 2)}\n`)
      },
    })
  })

  config
    .command(`get <key>`)
    .description(`读取配置项`)
    .action(async (key: string) => {
      const { config: loaded } = await loadWelightConfig()
      if (!(CONFIG_PATHS as readonly string[]).includes(key)) {
        ui.error(`未知配置项：${key}\n可用：${CONFIG_PATHS.join(`, `)}`)
        process.exitCode = 1
        return
      }
      const value = getConfigValue(loaded, key)
      process.stdout.write(`${value === undefined ? `` : String(value)}\n`)
    })

  config
    .command(`set <key> <value>`)
    .description(`写入配置项`)
    .action(async (key: string, value: string) => {
      try {
        const { file } = setConfigValue(key, value)
        ui.success(`${key} = ${value}  →  ${file}`)
      }
      catch (error) {
        ui.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
      }
    })

  config
    .command(`unset <key>`)
    .description(`删除配置项（恢复默认值）`)
    .action(async (key: string) => {
      try {
        const { file } = unsetConfigValue(key)
        ui.success(`已删除 ${key}  →  ${file}`)
      }
      catch (error) {
        ui.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
      }
    })
}
