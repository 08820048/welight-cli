import process from 'node:process'
import type { Command } from 'commander'
import { CREDENTIAL_SPECS, credentialStatus, credentialsFilePath, removeCredential, resolveCredentialName, saveCredential } from '../credentials'
import { loadWelightConfig, missingModelConfig } from '../config'
import { configureModel } from '../modelSetup'
import { askPassword, isInteractive } from '../prompt'
import { c, ui } from '../ui'

function listCredentials(): void {
  ui.title(`本地凭据`)
  const rows = credentialStatus()
  const width = Math.max(...rows.map(item => item.label.length))
  for (const item of rows) {
    const state = item.configured ? c.green(`已配置`) : c.dim(`未配置`)
    process.stdout.write(`  ${item.label.padEnd(width)}  ${state}  ${c.dim(item.name)}\n`)
  }
  process.stdout.write(`\n${c.dim(`凭据文件：${credentialsFilePath()}`)}\n`)
  process.stdout.write(`${c.dim(`设置：welight auth set <name>；也可运行 welight setup 向导。`)}\n`)
}

export function registerAuth(program: Command): void {
  const auth = program
    .command(`auth`)
    .description(`管理本地凭据（模型 / TypeSafe / 朱雀 / 公众号 密钥）`)
    .addHelpText(`after`, `\n凭据保存在本地文件，权限 0600，不会上传。\n\n示例:\n  $ welight auth set model                 # 遮罩输入模型 Key\n  $ welight auth set typesafe\n  $ welight auth set wechat-app-secret\n  $ welight auth list\n  $ welight auth remove zhuque`)

  auth.action(() => {
    listCredentials()
  })

  auth
    .command(`list`)
    .description(`列出凭据状态`)
    .action(() => {
      listCredentials()
    })

  auth
    .command(`set <name> [value]`)
    .description(`设置凭据；省略 value 时安全输入（不回显）`)
    .action(async (name: string, value?: string) => {
      const resolved = resolveCredentialName(name)
      if (!resolved) {
        ui.error(`未知凭据项：${name}\n可用：${Object.keys(CREDENTIAL_SPECS).join(`, `)}\n别名：model / typesafe / zhuque / wechat-app-id / wechat-app-secret`)
        process.exitCode = 1
        return
      }
      const label = CREDENTIAL_SPECS[resolved]

      let secret = (value ?? ``).trim()
      if (!secret) {
        if (!isInteractive()) {
          ui.error(`非交互环境请用：welight auth set ${resolved} <value>`)
          process.exitCode = 1
          return
        }
        secret = ((await askPassword(`请输入「${label}」`)) ?? ``).trim()
      }
      if (!secret) {
        ui.warn(`未输入内容，已取消`)
        return
      }
      saveCredential(resolved, secret)
      ui.success(`已保存「${label}」到 ${credentialsFilePath()}`)

      // 模型密钥：若还缺接口地址 / 模型名，继续补全
      if (resolved === `WELIGHT_MODEL_API_KEY`) {
        const { config } = await loadWelightConfig()
        if (missingModelConfig(config).length > 0) {
          ui.info(`模型还需要接口地址 / 模型名，继续补全：`)
          await configureModel({}, { onlyMissing: true })
        }
      }
    })

  auth
    .command(`remove <name>`)
    .description(`删除凭据`)
    .action((name: string) => {
      const resolved = resolveCredentialName(name)
      if (!resolved) {
        ui.error(`未知凭据项：${name}`)
        process.exitCode = 1
        return
      }
      removeCredential(resolved)
      ui.success(`已删除「${CREDENTIAL_SPECS[resolved]}」`)
    })
}
