import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, resolveFailOn } from '../config'
import { scanWechatRules } from '../engine'
import type { WechatRuleScanReport } from '../engine/shared/types'
import { readInput } from '../io'
import { p, presentCommand } from '../present'
import { inferTitle } from '../publish'
import { RULES_DATA, RULES_SOURCE_URL, RULES_UPDATED_AT, RULES_VERSION } from '../rulesData'
import { c, severityTag, ui } from '../ui'

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const

interface LintData {
  report: WechatRuleScanReport
}

export function registerLint(program: Command): void {
  program
    .command(`lint`)
    .description(`扫描文章命中的公众号平台规则（可用于 CI 门禁）`)
    .argument(`<file>`, `Markdown 文件路径，- 表示从 stdin 读取`)
    .option(`--title <title>`, `文章标题，默认从 front-matter / 一级标题推断`)
    .option(`--json`, `以 JSON 输出扫描报告`)
    .option(`--fail-on <level>`, `命中达到该级别时退出码为 1：none | low | medium | high（默认取配置）`)
    .addHelpText(`after`, `\n命中是风险线索而非违规结论，语义类规则需人工复核。\n\n示例:\n  $ welight lint post.md\n  $ welight lint post.md --fail-on high --json`)
    .action(async (file: string, options: { title?: string, json?: boolean, failOn?: string }) => {
      const { config } = await loadWelightConfig()
      const failOn = resolveFailOn(config, options.failOn)
      const markdown = await readInput(file)
      const title = options.title || inferTitle(markdown, ``)

      if (options.json) {
        process.stdout.write(`${JSON.stringify(scanWechatRules({ title, content: markdown }, RULES_DATA), null, 2)}\n`)
        return
      }

      const data = await presentCommand<LintData>({
        spinner: `扫描规则…`,
        run: async () => ({ report: scanWechatRules({ title, content: markdown }, RULES_DATA) }),
        view: ({ report }) => {
          p.log.info(`规则库 ${RULES_VERSION}（${RULES_UPDATED_AT}） · 检查 ${report.checkedRules} 条 · 命中 ${report.issues.length} 处`)
          if (report.issues.length === 0) {
            p.log.success(`未发现命中项`)
            return
          }
          const sorted = [...report.issues].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
          for (const issue of sorted) {
            const scope = issue.scope === `title` ? `标题` : `正文`
            process.stdout.write(`  ${severityTag(issue.severity)}  ${c.bold(issue.ruleTitle)} ${c.dim(`${issue.category} · ${scope}`)}\n`)
            process.stdout.write(`     ${c.dim(`命中`)}「${issue.span.text.replace(/\s+/g, ` `).slice(0, 80)}」\n`)
            if (issue.patternNote)
              process.stdout.write(`     ${c.dim(issue.patternNote)}\n`)
          }
          const counts = {
            high: report.issues.filter(i => i.severity === `high`).length,
            medium: report.issues.filter(i => i.severity === `medium`).length,
            low: report.issues.filter(i => i.severity === `low`).length,
          }
          process.stdout.write(`\n${severityTag(`high`)} ${counts.high}  ${severityTag(`medium`)} ${counts.medium}  ${severityTag(`low`)} ${counts.low}\n`)
        },
        plain: ({ report }) => {
          process.stdout.write(`公众号规则检查\n`)
          process.stdout.write(`${c.dim(`规则库 ${RULES_VERSION}（${RULES_UPDATED_AT}） · 检查 ${report.checkedRules} 条 · 命中 ${report.issues.length} 处`)}\n\n`)
          if (report.issues.length === 0) {
            ui.success(`未发现命中项`)
          }
          else {
            const sorted = [...report.issues].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
            for (const issue of sorted) {
              const scope = issue.scope === `title` ? `标题` : `正文`
              process.stdout.write(`  ${severityTag(issue.severity)}  ${c.bold(issue.ruleTitle)} ${ui.dim(`${issue.category} · ${scope}`)}\n`)
              process.stdout.write(`     ${ui.dim(`命中`)}「${issue.span.text.replace(/\s+/g, ` `).slice(0, 80)}」\n`)
              if (issue.patternNote)
                process.stdout.write(`     ${ui.dim(issue.patternNote)}\n`)
            }
          }
          process.stdout.write(`\n${ui.dim(`来源 ${RULES_SOURCE_URL}`)}\n`)
        },
      })

      if (data && failOn !== `none`) {
        const threshold = SEVERITY_WEIGHT[failOn as `high` | `medium` | `low`]
        if (data.report.issues.some(issue => SEVERITY_WEIGHT[issue.severity] >= threshold))
          process.exitCode = 1
      }
    })
}
