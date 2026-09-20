import process from 'node:process'
import type { Command } from 'commander'
import { copyRichHtml } from '../clipboard'
import { loadWelightConfig, resolveCodeTheme } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { p, presentCommand } from '../present'
import { ui } from '../ui'
import { buildWeChatInlineHtml, htmlToPlainText } from '../wechat'

interface CopyData {
  html: boolean
}

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

      const data = await presentCommand<CopyData>({
        spinner: `生成并写入剪贴板…`,
        run: async () => {
          const markdown = await readInput(file)
          const html = buildWeChatInlineHtml(markdown, {
            theme: options.theme ?? config.theme,
            primaryColor: config.primaryColor,
            fontFamily: config.fontFamily,
            fontSize: config.fontSize,
            customCSS: config.customCSS,
            codeTheme: resolveCodeTheme(config, options.codeTheme),
          })
          const result = await copyRichHtml(html, htmlToPlainText(html))
          return { html: result.html }
        },
        view: (result) => {
          p.log.success(`已复制到剪贴板，请粘贴到公众号后台编辑器`)
          if (!result.html)
            p.log.warn(`未能写入 HTML 格式，仅写入了纯文本`)
        },
        plain: (result) => {
          if (!result.html)
            ui.warn(`未能写入 HTML 格式，仅写入了纯文本`)
          ui.success(`已复制到剪贴板，请粘贴到公众号后台编辑器`)
        },
      })
      void data
    })
}
