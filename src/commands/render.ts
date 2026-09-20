import fs from 'node:fs/promises'
import { Command, Option } from 'clipanion'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { renderDocument } from '../render'

export class RenderCommand extends Command {
  static paths = [[`render`]]

  static usage = Command.Usage({
    description: `把 Markdown 渲染为带主题样式的 HTML`,
    details: `
      使用与桌面端一致的渲染内核与免费主题输出 HTML。
      文件参数传 "-" 时从 stdin 读取。
    `,
    examples: [
      [`渲染到 stdout`, `$0 render post.md`],
      [`指定主题并写入文件`, `$0 render post.md --theme w011 --out out.html`],
      [`从管道读取`, `cat post.md | $0 render - > out.html`],
    ],
  })

  file = Option.String({ required: true })

  theme = Option.String(`--theme,-t`, {
    description: `免费主题名（默认取配置，见 welight themes）`,
  })

  out = Option.String(`--out,-o`, {
    description: `输出文件路径，缺省写到 stdout`,
  })

  async execute(): Promise<number> {
    installDom()

    const { config } = await loadWelightConfig()
    const markdown = await readInput(this.file)

    let html: string
    try {
      html = renderDocument(markdown, {
        theme: this.theme ?? config.theme,
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        customCSS: config.customCSS,
      })
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    if (this.out) {
      await fs.writeFile(this.out, html, `utf8`)
      this.context.stdout.write(`已写入 ${this.out}\n`)
    }
    else {
      this.context.stdout.write(html)
    }
    return 0
  }
}
