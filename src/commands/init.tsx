import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { Command } from 'commander'
import { Box } from 'ink'
import type { ReactNode } from 'react'
import { DEFAULT_CONFIG } from '../config'
import { Success, Warning } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { ui } from '../ui'

const CONFIG_FILE = `welight.config.json`

interface InitData {
  created: boolean
  target: string
}

function View({ data }: { data: InitData }): ReactNode {
  return (
    <Box>
      {data.created
        ? <Success>{`已生成 ${data.target}`}</Success>
        : <Warning>{`${CONFIG_FILE} 已存在，未覆盖`}</Warning>}
    </Box>
  )
}

export function registerInit(program: Command): void {
  program
    .command(`init`)
    .description(`生成 welight.config.json 配置模板`)
    .action(async () => {
      await executeCommand({
        run: async (): Promise<InitData> => {
          const target = path.join(process.cwd(), CONFIG_FILE)
          try {
            await fs.access(target)
            return { created: false, target }
          }
          catch {
            await fs.writeFile(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, `utf8`)
            return { created: true, target }
          }
        },
        render: data => <View data={data} />,
        plain: (data) => {
          if (data.created)
            ui.success(`已生成 ${data.target}`)
          else
            ui.warn(`${CONFIG_FILE} 已存在，未覆盖`)
        },
      })
    })
}
