import process from 'node:process'
import type { Command } from 'commander'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { ZhuqueDetectReport } from '../engine'
import { ZHUQUE_LABEL_NAMES } from '../engine'
import { readInput } from '../io'
import { KeyValueList, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { c, printKeyValues, ui } from '../ui'
import { aiRatio, detectAiText } from '../zhuqueApi'

function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 1000) / 10}%`
}

interface DetectData {
  report: ZhuqueDetectReport
  ratio: number
}

function View({ data }: { data: DetectData }): ReactNode {
  const labels = data.report.result.labels_ratio ?? {}
  const segments = data.report.result.segment_labels ?? []
  return (
    <Box flexDirection="column">
      <Title subtitle={`送检 ${data.report.detectedChars} 字${data.report.truncated ? `（已截断）` : ``}`}>朱雀 AIGC 检测</Title>
      <KeyValueList rows={[
        [`人工`, percent(labels[`0`])],
        [`AI 生成`, percent(labels[`1`])],
        [`疑似 AI`, percent(labels[`2`])],
        [`AI + 疑似`, percent(data.ratio)],
        [`整体疑似风险`, String(data.report.result.ratio_confidence ?? 0)],
      ]}
      />
      {segments.length > 0
        ? (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>{`分段判定（${segments.length} 段，最多展示 10 段）`}</Text>
              {segments.slice(0, 10).map((segment, index) => (
                <Text key={index} wrap="truncate-end">
                  {`  [${ZHUQUE_LABEL_NAMES[segment.label] ?? segment.label} ${percent(segment.conf)}] ${segment.text.replace(/\s+/g, ` `)}`}
                </Text>
              ))}
            </Box>
          )
        : null}
    </Box>
  )
}

export function registerDetect(program: Command): void {
  program
    .command(`detect`)
    .description(`腾讯朱雀 AIGC 检测（自配 EdgeOne Key）`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`--api-key <key>`, `EdgeOne API Key（默认读本地凭据 / WELIGHT_ZHUQUE_KEY）`)
    .option(`--json`, `以 JSON 输出完整报告`)
    .option(`--max-ai <percent>`, `AI + 疑似 AI 占比达到该百分比时退出码为 1`)
    .option(`--timeout <ms>`, `请求超时毫秒数，默认 20000`)
    .addHelpText(`after`, `\nCLI 不做官方代理，必须自配 EdgeOne API Key。\n\n示例:\n  $ welight detect post.md\n  $ welight detect post.md --max-ai 40`)
    .action(async (file: string, options: { apiKey?: string, json?: boolean, maxAi?: string, timeout?: string }) => {
      const apiKey = (options.apiKey ?? process.env.WELIGHT_ZHUQUE_KEY ?? ``).trim()
      if (!apiKey) {
        ui.error(`缺少 EdgeOne API Key。请运行 welight setup，或设置 WELIGHT_ZHUQUE_KEY。`)
        process.exitCode = 1
        return
      }
      const markdown = await readInput(file)
      const timeoutMs = options.timeout ? Number(options.timeout) : undefined
      const run = async (): Promise<DetectData> => {
        const report = await detectAiText(markdown, {
          apiKey,
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
          endpoint: process.env.WELIGHT_ZHUQUE_ENDPOINT,
        })
        return { report, ratio: aiRatio(report) }
      }

      if (options.json) {
        try {
          const data = await run()
          process.stdout.write(`${JSON.stringify({ ...data.report, aiRatio: data.ratio }, null, 2)}\n`)
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      const data = await executeCommand<DetectData>({
        run,
        render: result => <View data={result} />,
        plain: (result) => {
          const labels = result.report.result.labels_ratio ?? {}
          process.stdout.write(`朱雀 AIGC 检测\n`)
          printKeyValues([
            [`送检字符`, `${result.report.detectedChars}${result.report.truncated ? `（已截断）` : ``}`],
            [`人工`, percent(labels[`0`])],
            [`AI 生成`, percent(labels[`1`])],
            [`疑似 AI`, percent(labels[`2`])],
            [`AI + 疑似`, percent(result.ratio)],
          ])
        },
      })

      const threshold = options.maxAi ? Number(options.maxAi) : undefined
      if (data && threshold !== undefined && Number.isFinite(threshold) && data.ratio * 100 >= threshold)
        process.exitCode = 1
    })
}
