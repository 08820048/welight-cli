import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { loadWelightConfig, resolveCodeTheme, resolveProxy, resolveWatermark } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { KeyValueList, Success, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import type { PublishResult } from '../publish'
import { publishDraft } from '../publish'
import { c, ui } from '../ui'

interface PublishCliOptions {
  theme?: string
  codeTheme?: string
  title?: string
  author?: string
  digest?: string
  sourceUrl?: string
  cover?: string
  proxy?: string
  appId?: string
  appSecret?: string
  openComment?: boolean
  fansCommentOnly?: boolean
  watermark?: boolean
  preview?: boolean
}

function View({ data }: { data: PublishResult }): ReactNode {
  return (
    <Box flexDirection="column">
      <Success>草稿创建成功</Success>
      <Box marginTop={1}>
        <KeyValueList rows={[
          [`标题`, data.title],
          [`media_id`, data.mediaId],
          [`正文图片`, `${data.uploadedContentImageCount}/${data.contentImageCount} 已上传`],
          [`预览链接`, data.previewUrl || `未获取（可在公众号后台草稿箱查看）`],
        ]}
        />
      </Box>
    </Box>
  )
}

export function registerPublish(program: Command): void {
  program
    .command(`publish`)
    .description(`发布 Markdown 到公众号草稿箱`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`-t, --theme <name>`, `免费主题名（默认取配置）`)
    .option(`--code-theme <name>`, `highlight.js 代码高亮主题（默认取配置）`)
    .option(`--title <title>`, `文章标题，默认从 front-matter / 一级标题推断`)
    .option(`--author <name>`, `作者（≤16 字）`)
    .option(`--digest <text>`, `摘要（≤120 字）`)
    .option(`--source-url <url>`, `原文链接`)
    .option(`--cover <path>`, `封面图路径或 URL，默认取正文首图`)
    .option(`--proxy <origin>`, `自建微信 API 反向代理 origin，默认直连`)
    .option(`--app-id <id>`, `公众号 AppID（默认读本地凭据 / 环境变量）`)
    .option(`--app-secret <secret>`, `公众号 AppSecret（默认读本地凭据 / 环境变量）`)
    .option(`--open-comment`, `开启评论`)
    .option(`--fans-comment-only`, `仅粉丝可评论`)
    .option(`--watermark`, `追加文末水印`)
    .option(`--no-watermark`, `不追加文末水印`)
    .option(`--preview`, `创建后轮询草稿预览链接`)
    .addHelpText(`after`, `\n默认直连 api.weixin.qq.com，不使用官方代理：需先把当前出口 IP 加入\n公众号后台「开发 → 基本配置 → IP 白名单」，否则返回 40164。\n\n示例:\n  $ welight publish post.md --cover ./cover.png --preview`)
    .action(async (file: string, options: PublishCliOptions) => {
      installDom()

      const appId = (options.appId ?? process.env.WELIGHT_WECHAT_APP_ID ?? ``).trim()
      const appSecret = (options.appSecret ?? process.env.WELIGHT_WECHAT_APP_SECRET ?? ``).trim()
      if (!appId || !appSecret) {
        ui.error(`缺少公众号凭据。请运行 welight setup，或设置 WELIGHT_WECHAT_APP_ID / WELIGHT_WECHAT_APP_SECRET。`)
        process.exitCode = 1
        return
      }

      const { config } = await loadWelightConfig()
      const markdown = await readInput(file)
      const baseDir = file === `-` ? process.cwd() : path.dirname(path.resolve(file))

      const run = async (): Promise<PublishResult> => publishDraft(markdown, {
        baseDir,
        credentials: { appId, appSecret, proxy: resolveProxy(config, options.proxy) },
        theme: options.theme ?? config.theme,
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        customCSS: config.customCSS,
        codeTheme: resolveCodeTheme(config, options.codeTheme),
        title: options.title,
        author: options.author,
        digest: options.digest,
        contentSourceUrl: options.sourceUrl,
        cover: options.cover,
        openComment: options.openComment,
        fansCommentOnly: options.fansCommentOnly,
        watermark: resolveWatermark(config, options.watermark),
        preview: options.preview,
        onLog: message => process.stderr.write(`${c.dim(`· ${message}`)}\n`),
      })

      await executeCommand<PublishResult>({
        run,
        render: data => <View data={data} />,
        plain: (data) => {
          ui.success(`草稿创建成功`)
          process.stdout.write(`  ${c.dim(`标题`)}      ${data.title}\n`)
          process.stdout.write(`  ${c.dim(`media_id`)}  ${data.mediaId}\n`)
          process.stdout.write(`  ${c.dim(`正文图片`)}  ${data.uploadedContentImageCount}/${data.contentImageCount} 已上传\n`)
          process.stdout.write(`  ${c.dim(`预览链接`)}  ${data.previewUrl || `未获取（可在公众号后台草稿箱查看）`}\n`)
        },
      })
    })
}
