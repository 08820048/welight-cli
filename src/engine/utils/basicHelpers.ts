/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@61d1500d
 * 重新生成：node scripts/export-engine.mjs
 */
/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, `&amp;`) // 转义 &
    .replace(/</g, `&lt;`) // 转义 <
    .replace(/>/g, `&gt;`) // 转义 >
    .replace(/"/g, `&quot;`) // 转义 "
    .replace(/'/g, `&#39;`) // 转义 '
}

/**
 * 首字母大写
 */
export function ucfirst(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase()
}
