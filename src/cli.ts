import { Command } from 'commander'
import { VERSION } from './version'
import { loadCredentials } from './credentials'
import { registerAi } from './commands/ai'
import { registerAuth } from './commands/auth'
import { registerConfig } from './commands/config'
import { registerCopy } from './commands/copy'
import { registerDetect } from './commands/detect'
import { registerDoctor } from './commands/doctor'
import { registerInit } from './commands/init'
import { registerLint } from './commands/lint'
import { registerLayout } from './commands/layout'
import { registerModel } from './commands/model'
import { registerPublish } from './commands/publish'
import { registerRender } from './commands/render'
import { registerSetup } from './commands/setup'
import { registerThemes } from './commands/themes'
import { registerTitle } from './commands/title'
import { c } from './ui'

export function createCli(): Command {
  const program = new Command()

  program
    .name(`welight`)
    .description(`Welight CLI — 微信公众号 Markdown 排版与发布工具（免费开源，全部 BYOK）`)
    .version(VERSION, `-v, --version`, `输出版本号`)
    .showHelpAfterError(`（使用 --help 查看用法）`)

  registerRender(program)
  registerLayout(program)
  registerCopy(program)
  registerPublish(program)
  registerLint(program)
  registerDetect(program)
  registerTitle(program)
  registerAi(program)
  registerSetup(program)
  registerThemes(program)
  registerDoctor(program)
  registerInit(program)
  registerConfig(program)
  registerAuth(program)
  registerModel(program)

  program.addHelpText(
    `after`,
    [
      ``,
      `${c.bold(`快速开始`)}`,
      `  ${c.dim(`$`)} welight setup                                     ${c.dim(`配置向导（模型 / 密钥）`)}`,
      `  ${c.dim(`$`)} welight render post.md --theme w011 --out out.html   ${c.dim(`渲染预览`)}`,
      `  ${c.dim(`$`)} welight layout post.md --in-place                   ${c.dim(`一键排版`)}`,
      `  ${c.dim(`$`)} welight copy post.md                                 ${c.dim(`复制到公众号`)}`,
      `  ${c.dim(`$`)} welight lint post.md                                 ${c.dim(`发布前规则检查`)}`,
      `  ${c.dim(`$`)} welight ai --chat                                  ${c.dim(`AI 对话助手`)}`,
      ``,
      `${c.dim(`文档: https://github.com/08820048/welight-cli`)}`,
    ].join(`\n`),
  )

  return program
}

export async function run(argv: string[]): Promise<void> {
  loadCredentials()
  const program = createCli()
  await program.parseAsync(argv)
}
