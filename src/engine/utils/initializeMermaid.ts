/* eslint-disable */
/**
 * ⚠️ 此文件由 wlight 仓库自动导出，请勿手动修改。
 * synced from wlight@61d1500d
 * 重新生成：node scripts/export-engine.mjs
 */
const MERMAID_INIT_FLAG = `__welight_mermaid_initialized__`

let mermaidInstance: any | null = null
let mermaidModulePromise: Promise<any> | null = null

function loadWindowMermaid(): any | null {
  if (typeof window !== `undefined` && (window as any).mermaid) {
    mermaidInstance = (window as any).mermaid
    return mermaidInstance
  }
  return null
}

async function loadBundledMermaid(): Promise<any | null> {
  if (mermaidInstance)
    return mermaidInstance

  // 动态引入 mermaid：静态引入会把它拖进入口 chunk，拖慢应用启动
  mermaidModulePromise ??= import('mermaid')
  const mermaidModule = await mermaidModulePromise
  mermaidInstance = (mermaidModule as any).default ?? mermaidModule
  if (typeof window !== `undefined`)
    (window as any).mermaid = mermaidInstance

  return mermaidInstance
}

export async function ensureMermaidReady(): Promise<any | null> {
  const mermaid = loadWindowMermaid() ?? await loadBundledMermaid()
  if (!mermaid)
    return null

  if (!(mermaid as any)[MERMAID_INIT_FLAG]) {
    mermaid.initialize({ startOnLoad: false })
    ;(mermaid as any)[MERMAID_INIT_FLAG] = true
  }

  return mermaid
}

export async function initializeMermaid() {
  await ensureMermaidReady()
}
