/**
 * CLI 版本号：直接从 package.json 读取，避免与 package.json 漂移。
 * 开发态（src/）与打包后（dist/）都指向同一份 package.json。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function readVersion(): string {
  try {
    const file = fileURLToPath(new URL(`../package.json`, import.meta.url))
    const pkg = JSON.parse(readFileSync(file, `utf8`)) as { version?: string }
    return pkg.version ?? `0.0.0`
  }
  catch {
    return `0.0.0`
  }
}

export const VERSION = readVersion()
