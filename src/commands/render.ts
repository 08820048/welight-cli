import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { openInBrowser } from '../browser'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { themeOptions } from '../engine'
import { p } from '../present'
import { askSelect, isInteractive } from '../prompt'
import { readInput } from '../io'
import { renderDocument } from '../render'
import { rememberTheme, resolveArticleTheme } from '../themeMemory'
import { c, ui } from '../ui'

function defaultOutputPath(file: string): string {
  if (file === `-`)
    return path.resolve(process.cwd(), `welight-preview.html`)
  const resolved = path.resolve(file)
  const dir = path.dirname(resolved)
  const base = path.basename(resolved).replace(/\.[^.]+$/, ``)
  return path.join(dir, `${base}.html`)
}

export function registerRender(program: Command): void {
  program
    .command(`render`)
    .description(`选主题并渲染为 HTML，自动写文件并在浏览器打开`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`-t, --theme <name>`, `主题名，省略时会让你选择（见 welight themes）`)
    .option(`-o, --out <path>`, `输出文件路径，默认与源文件同名 .html`)
    .option(`--stdout`, `把 HTML 输出到 stdout（脚本/管道用），不写文件、不开浏览器`)
    .option(`--no-open`, `生成文件后不自动打开浏览器`)
    .addHelpText(`after`, `\n终端下的默认行为：选主题 → 写 HTML 文件 → 浏览器打开预览。\n管道或 --stdout 时输出原始 HTML，便于重定向。\n\n示例:\n  $ welight render post.md\n  $ welight render post.md --theme w011 --out out.html\n  $ cat post.md | welight render - --stdout > out.html`)
    .action(async (file: string, options: { theme?: string, out?: string, stdout?: boolean, open?: boolean }) => {
      installDom()
      const { config } = await loadWelightConfig()

      let theme = (options.theme ?? ``).trim()
      const remembered = resolveArticleTheme(config, file)
      if (!theme) {
        if (isInteractive()) {
          theme = (await askSelect(
            `选择主题`,
            themeOptions.map(option => ({ value: option.value, label: option.label, hint: option.desc })),
            remembered.theme,
          )) ?? remembered.theme
        }
        else {
          theme = remembered.theme
        }
      }

      const markdown = await readInput(file)
      let html: string
      try {
        html = renderDocument(markdown, {
          theme,
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

      // 管道 / --stdout：输出原始 HTML
      if (options.stdout || (!isInteractive() && !options.out)) {
        process.stdout.write(html)
        return
      }

      // 记住本篇预览用的主题，publish / copy 默认复用（预览什么发什么）
      rememberTheme(file, theme)

      const outPath = options.out ? path.resolve(options.out) : defaultOutputPath(file)
      await fs.writeFile(outPath, html, `utf8`)

      const shouldOpen = isInteractive() && options.open !== false
      if (shouldOpen)
        openInBrowser(outPath)
      p.log.success(`已生成 ${outPath}${shouldOpen ? `（已在浏览器打开）` : ``}  ${c.dim(`主题 ${theme}`)}`)
    })
}
