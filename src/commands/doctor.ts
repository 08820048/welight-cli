import process from 'node:process'
import { Command } from 'clipanion'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { themeOptions } from '../engine'

function keyState(name: string): string {
  return process.env[name] ? `已配置` : `未配置`
}

export class DoctorCommand extends Command {
  static paths = [[`doctor`]]

  static usage = Command.Usage({
    description: `检查运行环境、配置与密钥状态`,
    examples: [[`运行自检`, `$0 doctor`]],
  })

  async execute(): Promise<number> {
    installDom()
    const { config, configFile } = await loadWelightConfig()

    const rows: [string, string][] = [
      [`Node`, process.version],
      [`平台`, `${process.platform} ${process.arch}`],
      [`默认主题`, config.theme],
      [`配置文件`, configFile ?? `未找到（使用默认值，可运行 welight init 生成）`],
      [`免费主题数`, String(themeOptions.length)],
      [`模型密钥`, keyState(`WELIGHT_MODEL_API_KEY`)],
      [`TypeSafe 判断层密钥`, keyState(`WELIGHT_TYPESAFE_KEY`)],
      [`朱雀 EdgeOne 密钥`, keyState(`WELIGHT_ZHUQUE_KEY`)],
      [`微信 AppID`, keyState(`WELIGHT_WECHAT_APP_ID`)],
    ]

    const width = Math.max(...rows.map(([k]) => k.length))
    const output = rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join(`\n`)
    this.context.stdout.write(`Welight CLI 自检：\n${output}\n\n`)
    return 0
  }
}
