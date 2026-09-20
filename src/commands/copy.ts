import { Command, Option } from 'clipanion'
import { copyRichHtml } from '../clipboard'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { buildWeChatInlineHtml, htmlToPlainText } from '../wechat'

export class CopyCommand extends Command {
  static paths = [[`copy`]]

  static usage = Command.Usage({
    description: `生成公众号内联 HTML 并复制到剪贴板`,
    details: `
      与桌面端「复制到公众号」一致：生成内联样式的 HTML 写入系统剪贴板，
      在公众号后台编辑器直接粘贴即可。文件参数传 "-" 时从 stdin 读取。
    `,
    examples: [
      [`复制文章`, `$0 copy post.md`],
      [`指定主题与代码高亮`, `$0 copy post.md --theme w011 --code-theme github-dark`],
    ],
  })

  file = Option.String({ required: true })

  theme = Option.String(`--theme,-t`, {
    description: `免费主题名（默认取配置）`,
  })

  codeTheme = Option.String(`--code-theme`, {
    description: `highlight.js 代码高亮主题，默认 github-dark，none 关闭`,
  })

  async execute(): Promise<number> {
    installDom()

    const { config } = await loadWelightConfig()
    const markdown = await readInput(this.file)

    let html: string
    try {
      html = buildWeChatInlineHtml(markdown, {
        theme: this.theme ?? config.theme,
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        customCSS: config.customCSS,
        codeTheme: this.codeTheme ?? `github-dark`,
      })
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    const plain = htmlToPlainText(html)
    const result = await copyRichHtml(html, plain)
    if (!result.html) {
      this.context.stderr.write(`警告：未能写入 HTML 格式，仅写入了纯文本。\n`)
    }
    this.context.stdout.write(`已复制到剪贴板，请粘贴到公众号后台编辑器。\n`)
    return 0
  }
}
