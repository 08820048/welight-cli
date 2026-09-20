import process from 'node:process'
import type { Command } from 'commander'
import { copyRichHtml } from '../clipboard'
import { loadWelightConfig, resolveCodeTheme } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { ui } from '../ui'
import { buildWeChatInlineHtml, htmlToPlainText } from '../wechat'

export function registerCopy(program: Command): void {
  program
    .command(`copy`)
    .description(`生成公众号内联 HTML 并复制到剪贴板`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`-t, --theme <name>`, `免费主题名（默认取配置）`)
    .option(`--code-theme <name>`, `highlight.js 代码高亮主题，none 关闭（默认取配置）`)
    .addHelpText(`after`, `\n生成内联样式的 HTML 写入系统剪贴板，到公众号后台编辑器直接粘贴。\n\n示例:\n  $ welight copy post.md --theme w011`)
    .action(async (file: string, options: { theme?: string, codeTheme?: string }) => {
      installDom()
      const { config } = await loadWelightConfig()
      const markdown = await readInput(file)

      let html: string
      try {
        html = buildWeChatInlineHtml(markdown, {
          theme: options.theme ?? config.theme,
          primaryColor: config.primaryColor,
          fontFamily: config.fontFamily,
          fontSize: config.fontSize,
          customCSS: config.customCSS,
          codeTheme: resolveCodeTheme(config, options.codeTheme),
        })
      }
      catch (error) {
        ui.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }

      const result = await copyRichHtml(html, htmlToPlainText(html))
      if (!result.html)
        ui.warn(`未能写入 HTML 格式，仅写入了纯文本`)
      ui.success(`已复制到剪贴板，请粘贴到公众号后台编辑器`)
    })
}
