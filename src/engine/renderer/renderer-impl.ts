/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@bd850083
 * 重新生成：node scripts/export-engine.mjs
 */
import type { IOpts, RendererAPI } from '../shared/types'
import type { ReadTimeResults } from 'reading-time'
import frontMatter from 'front-matter'
import hljs from 'highlight.js/lib/core'
import { marked } from 'marked'
import readingTime from 'reading-time'
import { markedAlert, markedCjkEmphasis, markedFootnotes, markedMarkup, markedPlantUML, markedRuby, markedSlider, markedToc, MDKatex } from '../extensions'
import { ensureMermaidReady } from '../utils/initializeMermaid'
import { COMMON_LANGUAGES, hasHighlightLanguage, highlightAndFormatCode, registerHighlightLanguage } from '../utils/languages'

Object.entries(COMMON_LANGUAGES).forEach(([name, lang]) => {
  registerHighlightLanguage(name, lang, hljs)
})

export { hljs }

// 中文提示框配置
const chineseAlertVariants = [
  {
    type: `note`,
    icon: `<svg class="octicon octicon-info" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
    title: `笔记`,
  },
  {
    type: `tip`,
    icon: `<svg class="octicon octicon-light-bulb" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"></path></svg>`,
    title: `提示`,
  },
  {
    type: `info`,
    icon: `<svg class="octicon octicon-info" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
    title: `信息`,
  },
  {
    type: `important`,
    icon: `<svg class="octicon octicon-report" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`,
    title: `重要`,
  },
  {
    type: `warning`,
    icon: `<svg class="octicon octicon-alert" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`,
    title: `警告`,
  },
  {
    type: `caution`,
    icon: `<svg class="octicon octicon-stop" style="margin-right: 0.25em;" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>`,
    title: `注意`,
  },
]

marked.setOptions({
  breaks: true,
})
marked.use(markedSlider() as any)

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, `&amp;`) // 转义 &
    .replace(/</g, `&lt;`) // 转义 <
    .replace(/>/g, `&gt;`) // 转义 >
    .replace(/"/g, `&quot;`) // 转义 "
    .replace(/'/g, `&#39;`) // 转义 '
    .replace(/`/g, `&#96;`) // 转义 `
}

function buildAddition(): string {
  return `
    <style>
      .preview-wrapper pre::before {
        position: absolute;
        top: 0;
        right: 0;
        color: #ccc;
        text-align: center;
        font-size: 0.8em;
        padding: 5px 10px 0;
        line-height: 15px;
        height: 15px;
        font-weight: 600;
      }
    </style>
  `
}

function buildFootnoteArray(footnotes: [number, string, string][]): string {
  // title/link 来自用户 Markdown 原文，插值前必须转义，防止绕过消毒的 XSS
  return footnotes
    .map(([index, title, link]) =>
      link === title
        ? `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code>: <i style="word-break: break-all">${escapeHtml(title)}</i><br/>`
        : `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code> ${escapeHtml(title)}: <i style="word-break: break-all">${escapeHtml(link)}</i><br/>`,
    )
    .join(`\n`)
}

function transform(legend: string, text: string | null, title: string | null): string {
  const options = legend.split(`-`)
  for (const option of options) {
    if (option === `alt` && text) {
      return text
    }
    if (option === `title` && title) {
      return title
    }
  }
  return ``
}

const macCodeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130">
    <ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" />
    <ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" />
    <ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" />
  </svg>
`.trim()

interface ParseResult {
  yamlData: Record<string, any>
  markdownContent: string
  readingTime: ReadTimeResults
}

/**
 * 判断链接协议是否安全（白名单：http/https/mailto/锚点/相对路径）
 * 拒绝 javascript:/data:/vbscript: 等危险协议
 */
function isSafeLinkHref(href: string): boolean {
  if (!href) {
    return false
  }
  // 去除控制字符与空白，防止 `java\nscript:` 之类的混淆
  const normalized = [...href].filter(ch => ch.charCodeAt(0) > 0x20).join(``)
  const protocolMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!protocolMatch) {
    // 锚点、相对路径、协议相对地址（// 解析为 http/https）
    return true
  }
  return /^(?:https?|mailto)$/i.test(protocolMatch[1])
}

function parseFrontMatterAndContent(markdownText: string): ParseResult {
  try {
    const parsed = frontMatter(markdownText)
    const yamlData = parsed.attributes
    const markdownContent = parsed.body

    const readingTimeResult = readingTime(markdownContent)

    return {
      yamlData: yamlData as Record<string, any>,
      markdownContent,
      readingTime: readingTimeResult,
    }
  }
  catch (error) {
    console.error(`Error parsing front-matter:`, error)
    return {
      yamlData: {},
      markdownContent: markdownText,
      readingTime: readingTime(markdownText),
    }
  }
}

// 扩展只注册一次的模块级标记（marked.use 不去重）
let extensionsRegistered = false

export function initRenderer(opts: IOpts = {}): RendererAPI {
  const footnotes: [number, string, string][] = []
  let footnoteIndex: number = 0
  let codeIndex: number = 0
  const listOrderedStack: boolean[] = []
  const listCounters: number[] = []

  function getOpts(): IOpts {
    return opts
  }

  /**
   * 生成带 CSS 类的内容（新主题系统）
   * @param styleLabel CSS 类名标识
   * @param content 内容
   * @param tagName HTML 标签名（可选）
   */
  function styledContent(styleLabel: string, content: string, tagName?: string): string {
    const tag = tagName ?? styleLabel
    const baseClass = `${styleLabel.replace(/_/g, `-`)}`
    // 兼容旧主题系统：为根容器额外添加 .md-container，方便主题通过 .md-container 定义背景等样式
    const extraClass = styleLabel === `container` ? ` md-container` : ``
    const headingAttr = /^h\d$/.test(tag) ? ` data-heading="true"` : ``
    return `<${tag} class="${baseClass}${extraClass}"${headingAttr}>${content}</${tag}>`
  }

  function addFootnote(title: string, link: string): number {
    // 检查是否已经存在相同的链接
    const existingFootnote = footnotes.find(([, , existingLink]) => existingLink === link)
    if (existingFootnote) {
      return existingFootnote[0] // 返回已存在的脚注索引
    }

    // 如果不存在，创建新的脚注
    footnotes.push([++footnoteIndex, title, link])
    return footnoteIndex
  }

  function reset(newOpts: Partial<IOpts>): void {
    footnotes.length = 0
    footnoteIndex = 0
    setOptions(newOpts)
  }

  function setOptions(newOpts: Partial<IOpts>): void {
    opts = { ...opts, ...newOpts }
    // 扩展已在 initRenderer 中以常量参数注册一次；
    // marked.use 不去重，重复注册会使 tokenizer 队列随每次渲染无限增长
  }

  function buildReadingTime(readingTime: ReadTimeResults): string {
    if (!opts.countStatus) {
      return ``
    }
    if (!readingTime.words) {
      return ``
    }
    return `
      <blockquote class="md-blockquote">
        <p class="md-blockquote-p">字数 ${readingTime?.words}，阅读大约需 ${Math.ceil(readingTime?.minutes)} 分钟</p>
      </blockquote>
    `
  }

  const buildFootnotes = () => {
    if (!footnotes.length) {
      return ``
    }

    return (
      styledContent(`h4`, `引用链接`)
      + styledContent(`footnotes`, buildFootnoteArray(footnotes), `p`)
    )
  }

  const renderer: any = {
    /**
     * 处理标题渲染
     * - H2：外层包裹 `md-h2-label`，纯文本时首字包裹 `md-h2-first`
     */
    heading({ tokens, depth }: any) {
      const text = this.parser.parseInline(tokens)
      const tag = `h${depth}`
      // H2：
      // 1）整体包裹一层 <span class="md-h2-label">...</span>，方便复杂装饰（如 W010 的"横线 + 下垂标签"效果）；
      // 2）在纯文本场景下，再额外把首字包一层 <span class="md-h2-first">...</span>，供部分主题做首字放大。
      if (depth === 2) {
        let inner = text
        // 如包含内联 HTML（<strong> 等），为避免破坏结构，这里只做外层 label 包裹
        if (!text.includes(`<`)) {
          const leadingSpacesMatch = text.match(/^\s*/)
          const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0] : ``
          const trimmed = text.slice(leadingSpaces.length)
          if (trimmed.length > 0) {
            // 使用 Array.from 正确处理 Unicode 字符（如 emoji），避免将 surrogate pair 拆开导致乱码
            const chars = Array.from(trimmed)
            const firstChar = chars[0]
            const rest = chars.slice(1).join(``)
            inner = `${leadingSpaces}<span class="md-h2-first">${firstChar}</span>${rest}`
          }
        }
        // 仅包裹标签，不注入横线占位；横线效果（如 W010）由各主题自行使用 CSS 控制
        const wrapped = `<span class="md-h2-label">${inner}</span>`
        return styledContent(tag, wrapped)
      }
      return styledContent(tag, text)
    },

    /**
     * 处理段落渲染
     * - 纯文本段落首字包裹 `md-p-first`，供个别主题使用
     */
    paragraph({ tokens }: any): string {
      const text = this.parser.parseInline(tokens)
      const isFigureImage = text.includes(`<figure`) && text.includes(`<img`)
      const isEmpty = text.trim() === ``
      if (isFigureImage || isEmpty) {
        return text
      }
      // 段落首字包裹 span，方便单个主题（如 W013）做首字放大等效果
      let content = text
      // 为避免破坏内联 HTML 结构，仅在纯文本段落时处理
      if (!text.includes(`<`)) {
        const leadingSpacesMatch = text.match(/^\s*/)
        const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0] : ``
        const trimmed = text.slice(leadingSpaces.length)
        if (trimmed.length > 0) {
          // 使用 Array.from 正确处理 Unicode 字符（如 emoji），避免将 surrogate pair 拆开导致乱码
          const chars = Array.from(trimmed)
          const firstChar = chars[0]
          const rest = chars.slice(1).join(``)
          content = `${leadingSpaces}<span class="md-p-first">${firstChar}</span>${rest}`
        }
      }
      return styledContent(`p`, content)
    },

    /**
     * 处理引用块渲染
     * - 为支持 W022 的左侧三个小方块装饰，注入 `md-blockquote-decoration` 与 3 个 `md-blockquote-dot`
     */
    blockquote({ tokens }: any): string {
      const text = this.parser.parse(tokens)
      // 左侧装饰容器（三个小方块）
      const decoration = `<span class="md-blockquote-decoration"><span class="md-blockquote-dot"></span><span class="md-blockquote-dot"></span><span class="md-blockquote-dot"></span></span>`
      // 新主题系统：blockquote 内的 p 标签由 CSS 控制，装饰容器置于内容前方
      return styledContent(`blockquote`, `${decoration}${text}`)
    },

    code({ text, lang = `` }: any): string {
      if (lang.startsWith(`mermaid`)) {
        clearTimeout(codeIndex)
        codeIndex = setTimeout(async () => {
          try {
            const mermaid = await ensureMermaidReady()
            if (!mermaid)
              return
            await mermaid.run()
          }
          catch (error) {
            console.error(`[mermaid] Render failed:`, error)
          }
        }, 0) as any as number
        return `<pre class="mermaid">${escapeHtml(text)}</pre>`
      }
      const langText = lang.split(` `)[0]
      const isLanguageRegistered = hasHighlightLanguage(langText, hljs)
      const language = isLanguageRegistered ? langText : `plaintext`

      const highlighted = highlightAndFormatCode(text, language, hljs, !!opts.isShowLineNumber)

      const span = `<span class="mac-sign" style="padding: 10px 14px 0;">${macCodeSvg}</span>`
      // 如果语言未注册，添加 data-language-pending 属性和原始代码文本用于后续动态加载
      let pendingAttr = ``
      if (!isLanguageRegistered && langText !== `plaintext`) {
        const escapedText = text.replace(/"/g, `&quot;`)
        pendingAttr = ` data-language-pending="${langText}" data-raw-code="${escapedText}" data-show-line-number="${opts.isShowLineNumber}"`
      }
      const code = `<code class="language-${lang}"${pendingAttr}>${highlighted}</code>`

      return `<pre class="hljs code__pre">${span}${code}</pre>`
    },

    codespan({ text }: any): string {
      const escapedText = escapeHtml(text)
      return styledContent(`codespan`, escapedText, `code`)
    },

    list({ ordered, items, start = 1 }: any) {
      listOrderedStack.push(ordered)
      listCounters.push(Number(start))

      const html = items
        .map((item: any) => this.listitem(item))
        .join(``)

      listOrderedStack.pop()
      listCounters.pop()

      return styledContent(
        ordered ? `ol` : `ul`,
        html,
      )
    },

    // 2. listitem：从栈顶取 ordered + counter，计算 prefix 并自增
    listitem(token: any) {
      // const ordered = listOrderedStack[listOrderedStack.length - 1]
      const idx = listCounters[listCounters.length - 1]!

      // 准备下一个
      listCounters[listCounters.length - 1] = idx + 1

      // 不再手动添加前缀，让浏览器的原生 list-style 来显示
      // const prefix = ordered
      //   ? `${idx}. `
      //   : `• `

      // 任务列表项：渲染为禁用 checkbox + 内联内容
      if (token.task) {
        let innerContent: string
        try {
          innerContent = this.parser.parseInline(token.tokens)
        }
        catch {
          innerContent = this.parser
            .parse(token.tokens)
            .replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/, `$1`)
        }
        const checkbox = `<input type=”checkbox” class=”md-task-checkbox” disabled${token.checked ? ` checked` : ``} />`
        return `<li class=”listitem md-task-item”>${checkbox}<span class=”md-task-label”>${innerContent}</span></li>`
      }

      // 渲染内容：优先 inline，fallback 去掉 <p> 包裹
      let content: string
      try {
        content = this.parser.parseInline(token.tokens)
      }
      catch {
        content = this.parser
          .parse(token.tokens)
          .replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/, `$1`)
      }

      // 针对公众号复制的兼容性：
      // 无序/有序列表中，如果内容包含加粗（<strong>）、代码等内联标签，
      // 公众号编辑器有时会在全角冒号”：”后面强制换行。
      // 参考同类产品实践：在 li 内部使用 <section> + 多个 <span> 的结构包裹内容，
      // 尤其是「开头加粗 + 后面普通文本」的场景：
      //   <li>
      //     <section class=”md-li-content”>
      //       <strong><span>这是加粗文本：</span></strong>
      //       <span>这是列表 n 内容文本</span>
      //     </section>
      //   </li>
      // 这样可以显著降低公众号在标点后的错误换行概率。
      const hasBlockLevelTag = /<(?:p|div|ul|ol|pre|figure|table|blockquote|h[1-6])\b/i.test(content)
      if (!hasBlockLevelTag) {
        // 如果列表项以一个单独的 <strong> 开头，拆成：
        //   <strong><span>加粗部分</span></strong><span>其余内容</span>
        // 并整体放入 <section class=”md-li-content”> 中。
        const strongMatch = content.match(/^\s*<strong([^>]*)>([\s\S]+?)<\/strong>([\s\S]*)$/)

        if (strongMatch) {
          const strongAttrs = strongMatch[1] || ``
          const strongInner = strongMatch[2] || ``
          const rest = strongMatch[3] || ``

          const boldSpan = `<strong${strongAttrs}><span>${strongInner}</span></strong>`
          const restSpan = rest ? `<span>${rest}</span>` : ``

          content = `<section class=”md-li-content”>${boldSpan}${restSpan}</section>`
        }
        else {
          // 其它纯内联内容，整体包到 section 里
          content = `<section class=”md-li-content”>${content}</section>`
        }
      }

      return styledContent(
        `listitem`,
        content, // 不再添加前缀
        `li`,
      )
    },

    image({ href, title, text }: any): string {
      const subText = styledContent(`figcaption`, transform(opts.legend ?? ``, text, title))
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ``
      return `<figure><img src="${escapeHtml(href ?? ``)}"${titleAttr} alt="${escapeHtml(text ?? ``)}"/>${subText}</figure>`
    },

    link({ href, title, text, tokens }: any): string {
      const parsedText = this.parser.parseInline(tokens)
      // 协议白名单：危险协议（javascript:/data:/vbscript: 等）降级为纯文本
      if (!isSafeLinkHref(href)) {
        return parsedText
      }
      const safeHref = escapeHtml(href)
      const safeTitle = escapeHtml(title || text || ``)
      if (/^https?:\/\/mp\.weixin\.qq\.com/.test(href)) {
        return `<a href="${safeHref}" title="${safeTitle}">${parsedText}</a>`
      }
      if (href === text) {
        return parsedText
      }
      const newTabAttrs = opts.openLinksInNewTab ? ` target="_blank" rel="noopener noreferrer"` : ``
      if (opts.citeStatus) {
        const ref = addFootnote(title || text, href)
        return `<a href="${safeHref}" title="${safeTitle}"${newTabAttrs}>${parsedText}<sup>[${ref}]</sup></a>`
      }
      return `<a href="${safeHref}" title="${safeTitle}"${newTabAttrs}>${parsedText}</a>`
    },

    strong({ tokens }: any): string {
      return styledContent(`strong`, this.parser.parseInline(tokens))
    },

    em({ tokens }: any): string {
      return styledContent(`em`, this.parser.parseInline(tokens))
    },

    table({ header, rows }: any): string {
      const headerRow = header
        .map((cell: any) => {
          const text = this.parser.parseInline(cell.tokens)
          const align = cell.align ? ` style="text-align: ${cell.align};"` : ``
          return `<th class="th"${align}>${text}</th>`
        })
        .join(``)
      const body = rows
        .map((row: any) => {
          const rowContent = row
            .map((cell: any) => this.tablecell(cell))
            .join(``)
          return styledContent(`tr`, rowContent)
        })
        .join(``)
      return `
        <section style="max-width: 100%; overflow: auto">
          <table class="preview-table">
            <thead>${headerRow}</thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `
    },

    tablecell(token: any): string {
      const text = this.parser.parseInline(token.tokens)
      const align = token.align ? ` style="text-align: ${token.align};"` : ``
      return `<td class="td"${align}>${text}</td>`
    },

    hr(_: any): string {
      return styledContent(`hr`, ``)
    },
  }

  marked.use({ renderer })
  // 新主题系统：扩展不再需要 styles 参数
  // 所有扩展参数均为模块级常量，只需注册一次；
  // marked.use 不去重，重复注册会导致 tokenizer 队列无限增长（性能劣化 + 内存泄漏）
  if (!extensionsRegistered) {
    extensionsRegistered = true
    marked.use(markedCjkEmphasis())
    marked.use(markedMarkup())
    marked.use(markedToc())
    marked.use(markedSlider() as any)
    marked.use(markedAlert({ variants: chineseAlertVariants }))
    marked.use((MDKatex as any)({ nonStandard: true }, true) as any)
    marked.use(markedFootnotes())
    marked.use(markedPlantUML({
      inlineSvg: true, // 启用SVG内嵌，适用于微信公众号
    }))
    marked.use(markedRuby())
  }

  return {
    buildAddition,
    buildFootnotes,
    setOptions,
    reset,
    parseFrontMatterAndContent,
    buildReadingTime,
    createContainer(content: string) {
      return styledContent(`container`, content, `section`)
    },
    getOpts,
  }
}
