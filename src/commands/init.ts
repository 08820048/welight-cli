import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Command } from 'clipanion'
import { DEFAULT_CONFIG } from '../config'

const CONFIG_FILE = `welight.config.json`

export class InitCommand extends Command {
  static paths = [[`init`]]

  static usage = Command.Usage({
    description: `生成 welight.config.json 配置模板`,
    examples: [[`生成配置`, `$0 init`]],
  })

  async execute(): Promise<number> {
    const target = path.join(process.cwd(), CONFIG_FILE)
    try {
      await fs.access(target)
      this.context.stdout.write(`${CONFIG_FILE} 已存在，未覆盖。\n`)
      return 0
    }
    catch {
      // 不存在则写入
    }

    await fs.writeFile(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, `utf8`)
    this.context.stdout.write(`已生成 ${target}\n`)
    return 0
  }
}
