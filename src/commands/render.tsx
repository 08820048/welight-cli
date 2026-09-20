import fs from 'node:fs/promises'
import process from 'node:process'
import type { Command } from 'commander'
import { Box } from 'ink'
import type { ReactNode } from 'react'
import { loadWelightConfig } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { Success } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { renderDocument } from '../render'
import { ui } from '../ui'

interface RenderData {
  out?: string
}

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
      const build = async (): Promise<string> => {
        const markdown = await readInput(file)
        return renderDocument(markdown, {
          theme: options.theme ?? config.theme,
          primaryColor: config.primaryColor,
          fontFamily: config.fontFamily,
          fontSize: config.fontSize,
          customCSS: config.customCSS,
        })
      }

      // 输出 HTML 到 stdout 时必须走纯文本，避免被 Ink 折行破坏
      if (!options.out) {
        try {
          process.stdout.write(await build())
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      const out = options.out
      await executeCommand<RenderData>({
        run: async () => {
          await fs.writeFile(out, await build(), `utf8`)
          return { out }
        },
        render: data => (
          <Box>
            <Success>{`已写入 ${data.out}`}</Success>
          </Box>
        ) as ReactNode,
        plain: data => ui.success(`已写入 ${data.out}`),
      })
    })
}
