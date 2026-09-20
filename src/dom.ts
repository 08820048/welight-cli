/**
 * Node 环境下的最小 DOM 适配。
 *
 * 渲染内核中的 PlantUML / KaTeX 适配器会访问 document / window，
 * 这些能力只在遇到对应语法块时才触发。这里在 CLI 启动时安装 linkedom，
 * 让内核代码无需改动即可在 Node 中运行。
 */

import { DOMParser, parseHTML } from 'linkedom'

let installed = false

function defineGlobal(name: string, value: unknown): void {
  try {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    })
  }
  catch {
    // 某些运行时把 navigator 等定义为不可配置的 getter，跳过即可
  }
}

export function installDom(): void {
  if (installed)
    return
  installed = true

  if (typeof (globalThis as any).document !== `undefined`)
    return

  const { window, document } = parseHTML(`<!doctype html><html><head></head><body></body></html>`)

  defineGlobal(`window`, window)
  defineGlobal(`document`, document)
  defineGlobal(`navigator`, window.navigator)
  defineGlobal(`DOMParser`, DOMParser)
}
