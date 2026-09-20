import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig } from '../config'
import { credentialsFilePath } from '../credentials'
import { installDom } from '../dom'
import { themeOptions } from '../engine'
import { c, printKeyValues, ui } from '../ui'

function keyState(name: string): string {
  return process.env[name] ? c.green(`已配置`) : c.dim(`未配置`)
}

export function registerDoctor(program: Command): void {
  program
    .command(`doctor`)
    .description(`检查运行环境、配置与密钥状态`)
    .action(async () => {
      installDom()
      const { config, configFile } = await loadWelightConfig()

      ui.title(`Welight CLI 自检`)
      printKeyValues([
        [`Node`, process.version],
        [`平台`, `${process.platform} ${process.arch}`],
        [`默认主题`, config.theme],
        [`代码高亮主题`, config.codeTheme],
        [`文末水印`, config.watermark ? `开启` : `关闭`],
        [`配置文件`, configFile ?? c.dim(`未创建（可运行 welight init）`)],
        [`凭据文件`, credentialsFilePath()],
        [`免费主题数`, String(themeOptions.length)],
        [`模型接口`, config.model.baseUrl || c.dim(`未配置`)],
        [`模型名`, config.model.model || c.dim(`未配置`)],
        [`模型密钥`, keyState(`WELIGHT_MODEL_API_KEY`)],
        [`TypeSafe 判断层密钥`, keyState(`WELIGHT_TYPESAFE_KEY`)],
        [`朱雀 EdgeOne 密钥`, keyState(`WELIGHT_ZHUQUE_KEY`)],
        [`微信 AppID`, keyState(`WELIGHT_WECHAT_APP_ID`)],
      ])
      process.stdout.write(`\n${c.dim(`提示：运行 welight setup 可通过对话完成配置。`)}\n`)
    })
}
