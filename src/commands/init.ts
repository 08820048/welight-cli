import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { DEFAULT_CONFIG } from '../config'
import { ui } from '../ui'

const CONFIG_FILE = `welight.config.json`

export function registerInit(program: Command): void {
  program
    .command(`init`)
    .description(`生成 welight.config.json 配置模板`)
    .action(async () => {
      const target = path.join(process.cwd(), CONFIG_FILE)
      try {
        await fs.access(target)
        ui.warn(`${CONFIG_FILE} 已存在，未覆盖`)
        return
      }
      catch {
        // 不存在则写入
      }
      await fs.writeFile(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, `utf8`)
      ui.success(`已生成 ${target}`)
    })
}
