import process from 'node:process'
import type { Command } from 'commander'
import { Box } from 'ink'
import type { ReactNode } from 'react'
import { loadWelightConfig } from '../config'
import { credentialsFilePath } from '../credentials'
import { installDom } from '../dom'
import { themeOptions } from '../engine'
import { Hint, KeyValueList, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { providerLabel } from '../modelSetup'
import { c, printKeyValues } from '../ui'

interface DoctorData {
  rows: Array<[string, string]>
}

async function collect(): Promise<DoctorData> {
  const { config, configFile } = await loadWelightConfig()
  const yes = c.green(`已配置`)
  const no = c.dim(`未配置`)
  return {
    rows: [
      [`Node`, process.version],
      [`平台`, `${process.platform} ${process.arch}`],
      [`默认主题`, config.theme],
      [`代码高亮主题`, config.codeTheme],
      [`文末水印`, config.watermark ? `开启` : `关闭`],
      [`配置文件`, configFile ?? `未创建`],
      [`凭据文件`, credentialsFilePath()],
      [`免费主题数`, String(themeOptions.length)],
      [`模型提供商`, config.model.provider ? providerLabel(config.model.provider) : `未配置`],
      [`模型接口`, config.model.baseUrl || `未配置`],
      [`模型名`, config.model.model || `未配置`],
      [`模型密钥`, process.env.WELIGHT_MODEL_API_KEY ? yes : no],
      [`TypeSafe 密钥`, process.env.WELIGHT_TYPESAFE_KEY ? yes : no],
      [`朱雀 EdgeOne 密钥`, process.env.WELIGHT_ZHUQUE_KEY ? yes : no],
      [`微信 AppID`, process.env.WELIGHT_WECHAT_APP_ID ? yes : no],
    ],
  }
}

function View({ data }: { data: DoctorData }): ReactNode {
  return (
    <Box flexDirection="column">
      <Title subtitle="运行环境、配置与密钥状态">Welight CLI 自检</Title>
      <KeyValueList rows={data.rows} />
      <Hint>运行 welight setup 可通过对话完成配置。</Hint>
    </Box>
  )
}

export function registerDoctor(program: Command): void {
  program
    .command(`doctor`)
    .description(`检查运行环境、配置与密钥状态`)
    .action(async () => {
      installDom()
      await executeCommand({
        run: collect,
        render: data => <View data={data} />,
        plain: (data) => {
          process.stdout.write(`Welight CLI 自检\n`)
          printKeyValues(data.rows)
          process.stdout.write(`\n${c.dim(`提示：运行 welight setup 可通过对话完成配置。`)}\n`)
        },
      })
    })
}
