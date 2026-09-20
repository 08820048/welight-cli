import process from 'node:process'
import type { Command } from 'commander'
import { Badge } from '@inkjs/ui'
import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { ArticleCheckupItem, ArticleCheckupReport } from '../checkup'
import { runCheckup } from '../checkup'
import { loadWelightConfig, resolveTypesafeEndpoint } from '../config'
import { Hint, KeyValueList, Title } from '../ink/components'
import { executeCommand } from '../ink/runtime'
import { readInput } from '../io'
import { inferTitle } from '../publish'
import { c, ui } from '../ui'

const STATUS_LABEL: Record<ArticleCheckupItem['status'], string> = {
  pass: `良好`,
  watch: `关注`,
  action: `建议处理`,
  unknown: `未判定`,
}

function StatusBadge({ status }: { status: ArticleCheckupItem['status'] }) {
  if (status === `pass`)
    return <Badge color="green">良好</Badge>
  if (status === `watch`)
    return <Badge color="yellow">关注</Badge>
  if (status === `action`)
    return <Badge color="red">建议处理</Badge>
  return <Badge color="gray">未判定</Badge>
}

function metric(item: ArticleCheckupItem): string {
  if (item.kind === `level`)
    return item.score !== undefined ? `${item.score.toFixed(1)} 级` : ``
  return item.probability !== undefined ? `${Math.round(item.probability * 100)}%` : ``
}

function View({ data }: { data: ArticleCheckupReport }): ReactNode {
  return (
    <Box flexDirection="column">
      <Title subtitle={`采样 ${data.sampledChars} 字${data.truncated ? `（已截断）` : ``}${data.model ? ` · ${data.model}` : ``}`}>文章体检</Title>
      <Box flexDirection="column">
        {data.items.map(item => (
          <Box key={item.id} flexDirection="column" marginBottom={item.status === `pass` ? 0 : 1}>
            <Box>
              <StatusBadge status={item.status} />
              <Text bold>{` ${item.label} `}</Text>
              <Text dimColor>{metric(item)}</Text>
            </Box>
            {item.status !== `pass` && item.status !== `unknown`
              ? <Text dimColor wrap="wrap">{`  ${item.suggestion}`}</Text>
              : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <KeyValueList rows={[
          [`良好`, String(data.counts.pass)],
          [`关注`, String(data.counts.watch)],
          [`建议处理`, String(data.counts.action)],
          [`未判定`, String(data.counts.unknown)],
        ]}
        />
      </Box>
      <Hint>体检来自判断层度量，是建议而非审核结论。</Hint>
    </Box>
  )
}

export function registerCheckup(program: Command): void {
  program
    .command(`checkup`)
    .description(`文章体检：12 项量化检查（需自配 TypeSafe Key）`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`--title <title>`, `文章标题，默认从 front-matter / 一级标题推断`)
    .option(`--typesafe-key <key>`, `TypeSafe API Key（默认读本地凭据 / WELIGHT_TYPESAFE_KEY）`)
    .option(`--timeout <ms>`, `请求超时毫秒数，默认 15000`)
    .option(`--json`, `以 JSON 输出`)
    .option(`--fail-on <level>`, `命中该状态时退出码为 1：action | watch | none（默认 none）`)
    .addHelpText(`after`, `\n维度：开头吸引力、结构、过渡、长段落、重复、术语、表格/图表机会、可读性、收尾、互动、标题一致性。\n\n示例:\n  $ welight checkup post.md\n  $ welight checkup post.md --fail-on action`)
    .action(async (file: string, options: { title?: string, typesafeKey?: string, timeout?: string, json?: boolean, failOn?: string }) => {
      const apiKey = (options.typesafeKey ?? process.env.WELIGHT_TYPESAFE_KEY ?? ``).trim()
      if (!apiKey) {
        ui.error(`缺少 TypeSafe Key。请运行 welight auth set typesafe，或设置 WELIGHT_TYPESAFE_KEY。`)
        process.exitCode = 1
        return
      }

      const { config } = await loadWelightConfig()
      const markdown = await readInput(file)
      const title = options.title || inferTitle(markdown, ``)
      const timeoutMs = options.timeout ? Number(options.timeout) : undefined

      const run = (): Promise<ArticleCheckupReport> => runCheckup(markdown, {
        title,
        apiKey,
        endpoint: resolveTypesafeEndpoint(config),
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      })

      if (options.json) {
        try {
          process.stdout.write(`${JSON.stringify(await run(), null, 2)}\n`)
        }
        catch (error) {
          ui.error(error instanceof Error ? error.message : String(error))
          process.exitCode = 1
        }
        return
      }

      const data = await executeCommand<ArticleCheckupReport>({
        run,
        render: report => <View data={report} />,
        plain: (report) => {
          process.stdout.write(`文章体检（采样 ${report.sampledChars} 字${report.truncated ? `，已截断` : ``}）\n\n`)
          for (const item of report.items) {
            process.stdout.write(`  ${STATUS_LABEL[item.status]}  ${item.label} ${c.dim(metric(item))}\n`)
            if (item.status !== `pass` && item.status !== `unknown`)
              process.stdout.write(`        ${c.dim(item.suggestion)}\n`)
          }
          process.stdout.write(`\n良好 ${report.counts.pass} · 关注 ${report.counts.watch} · 建议处理 ${report.counts.action} · 未判定 ${report.counts.unknown}\n`)
        },
      })

      const failOn = (options.failOn ?? `none`).trim()
      if (data && failOn !== `none`) {
        const failed = failOn === `watch`
          ? data.counts.watch + data.counts.action > 0
          : data.counts.action > 0
        if (failed)
          process.exitCode = 1
      }
    })
}
