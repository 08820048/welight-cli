/**
 * 系统剪贴板：写入带 text/html 的富文本，供粘贴到公众号后台。
 *
 * 使用 @crosscopy/clipboard（基于 clipboard-rs 的原生实现），
 * Windows 会自动按 CF_HTML 规范写入，避免手工拼接字节偏移出错。
 *
 * 注意：该库的 setHtml / setText 每次调用会整体替换剪贴板内容，
 * 两种 flavor 无法共存；公众号粘贴依赖 HTML flavor，因此优先写 HTML，
 * 仅当 HTML 写入失败时才回退为纯文本。
 */

import { setHtml, setText } from '@crosscopy/clipboard'

export interface CopyResult {
  html: boolean
  text: boolean
}

export async function copyRichHtml(html: string, text: string): Promise<CopyResult> {
  try {
    await setHtml(html)
    return { html: true, text: false }
  }
  catch {
    // 回退纯文本
  }

  try {
    await setText(text)
    return { html: false, text: true }
  }
  catch {
    throw new Error(`写入系统剪贴板失败（当前平台可能缺少预编译原生模块）`)
  }
}
