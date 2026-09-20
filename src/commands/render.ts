import fs from 'node:fs/promises'
import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { renderDocument } from '../render'
import { ui } from '../ui'

export function registerRender(program: Command): void {
  program
    .command(`render`)
    .description(`把 Markdown 渲染为带主题样式的 HTML`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`-t, --theme <name>`, `免费主题名（默认取配置，见 welight themes）`)
    .option(`-o, --out <path>`, `输出文件路径，缺省写到 stdout`)
    .addHelpText(`after`, `\n示例:\n  $ welight render post.md --theme w011 --out out.html\n  $ cat post.md | welight render - > out.html`)
    .action(async (file: string, options: { theme?: string, out?: string }) => {
      installDom()
      const { config } = await loadWelightConfig()
      const markdown = await readInput(file)

      let html: string
      try {
        html = renderDocument(markdown, {
          theme: options.theme ?? config.theme,
          primaryColor: config.primaryColor,
          fontFamily: config.fontFamily,
          fontSize: config.fontSize,
          customCSS: config.customCSS,
        })
      }
      catch (error) {
        ui.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }

      if (options.out) {
        await fs.writeFile(options.out, html, `utf8`)
        ui.success(`已写入 ${options.out}`)
      }
      else {
        process.stdout.write(html)
      }
    })
}
