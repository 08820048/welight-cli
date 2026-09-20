import path from 'node:path'
import process from 'node:process'
import { Command, Option } from 'clipanion'
import { loadWelightConfig, resolveCodeTheme, resolveProxy, resolveWatermark } from '../config'
import { installDom } from '../dom'
import { readInput } from '../io'
import { publishDraft } from '../publish'

export class PublishCommand extends Command {
  static paths = [[`publish`]]

  static usage = Command.Usage({
    description: `发布 Markdown 到公众号草稿箱`,
    details: `
      渲染公众号内联 HTML 后直连微信接口创建草稿，不做正式发布。
      直连 api.weixin.qq.com，需要把当前网络出口 IP 加入公众号后台 IP 白名单。

      AppID / AppSecret 从环境变量 WELIGHT_WECHAT_APP_ID / WELIGHT_WECHAT_APP_SECRET
      读取（也可用 --app-id / --app-secret 临时传入）。

      文件参数传 "-" 时从 stdin 读取，此时相对图片路径以当前目录为基准。
    `,
    examples: [
      [`发布为草稿`, `$0 publish post.md`],
      [`指定封面与主题`, `$0 publish post.md --cover ./cover.png --theme w011`],
      [`不使用内置代理（默认直连）`, `$0 publish post.md --proxy https://my-proxy.example.com`],
    ],
  })

  file = Option.String({ required: true })

  theme = Option.String(`--theme,-t`, { description: `免费主题名（默认取配置）` })

  codeTheme = Option.String(`--code-theme`, { description: `代码高亮主题，默认 github-dark` })

  title = Option.String(`--title`, { description: `文章标题，默认从 front-matter / 一级标题推断` })

  author = Option.String(`--author`, { description: `作者（≤16 字）` })

  digest = Option.String(`--digest`, { description: `摘要（≤120 字）` })

  sourceUrl = Option.String(`--source-url`, { description: `原文链接` })

  cover = Option.String(`--cover`, { description: `封面图路径或 URL，默认取正文首图` })

  proxy = Option.String(`--proxy`, { description: `自建微信 API 反向代理 origin，默认直连` })

  appId = Option.String(`--app-id`, { description: `公众号 AppID（默认读环境变量）` })

  appSecret = Option.String(`--app-secret`, { description: `公众号 AppSecret（默认读环境变量）` })

  openComment = Option.Boolean(`--open-comment`, false, { description: `开启评论` })

  fansCommentOnly = Option.Boolean(`--fans-comment-only`, false, { description: `仅粉丝可评论` })

  watermark = Option.Boolean(`--watermark`, { description: `是否追加文末水印（默认取配置，默认开启；--no-watermark 关闭）` })

  preview = Option.Boolean(`--preview`, false, { description: `创建后轮询草稿预览链接` })

  async execute(): Promise<number> {
    installDom()

    const { config } = await loadWelightConfig()
    const appId = (this.appId ?? process.env.WELIGHT_WECHAT_APP_ID ?? ``).trim()
    const appSecret = (this.appSecret ?? process.env.WELIGHT_WECHAT_APP_SECRET ?? ``).trim()
    if (!appId || !appSecret) {
      this.context.stderr.write(
        `错误：缺少公众号凭据。请设置环境变量 WELIGHT_WECHAT_APP_ID 与 WELIGHT_WECHAT_APP_SECRET，或使用 --app-id / --app-secret。\n`,
      )
      return 1
    }

    const markdown = await readInput(this.file)
    const baseDir = this.file === `-` ? process.cwd() : path.dirname(path.resolve(this.file))

    try {
      const result = await publishDraft(markdown, {
        baseDir,
        credentials: { appId, appSecret, proxy: resolveProxy(config, this.proxy) },
        theme: this.theme ?? config.theme,
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        customCSS: config.customCSS,
        codeTheme: resolveCodeTheme(config, this.codeTheme),
        title: this.title,
        author: this.author,
        digest: this.digest,
        contentSourceUrl: this.sourceUrl,
        cover: this.cover,
        openComment: this.openComment,
        fansCommentOnly: this.fansCommentOnly,
        watermark: resolveWatermark(config, this.watermark),
        preview: this.preview,
        onLog: message => this.context.stdout.write(`${message}\n`),
      })

      this.context.stdout.write(
        [
          ``,
          `标题：${result.title}`,
          `草稿 media_id：${result.mediaId}`,
          `正文图片：${result.uploadedContentImageCount}/${result.contentImageCount} 已上传`,
          result.previewUrl ? `预览链接：${result.previewUrl}` : `预览链接：未获取（可在公众号后台草稿箱查看）`,
          ``,
        ].join(`\n`),
      )
      return 0
    }
    catch (error) {
      this.context.stderr.write(`错误：${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }
  }
}
