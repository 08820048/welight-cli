import process from 'node:process'
import type { Command } from 'commander'
import { loadWelightConfig, resolveFailOn } from '../config'
import { readInput } from '../io'
import { inferTitle } from '../publish'
import { RULES_DATA, RULES_SOURCE_URL, RULES_UPDATED_AT, RULES_VERSION } from '../rulesData'
import { c, severityTag, ui } from '../ui'
import type { Severity } from '../ui'
import type { WechatRuleSeverity } from '../engine/shared/types'
import { scanWechatRules } from '../engine'

const SEVERITY_WEIGHT: Record<WechatRuleSeverity, number> = { high: 3, medium: 2, low: 1 }

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
      const report = scanWechatRules({ title, content: markdown }, RULES_DATA)

      if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      }
      else {
        ui.title(`公众号规则检查`)
        process.stdout.write(
          `${ui.dim(`规则库 ${RULES_VERSION}（${RULES_UPDATED_AT}） · 检查 ${report.checkedRules} 条 · 命中 ${report.issues.length} 处`)}\n\n`,
        )

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
          const counts = {
            high: report.issues.filter(i => i.severity === `high`).length,
            medium: report.issues.filter(i => i.severity === `medium`).length,
            low: report.issues.filter(i => i.severity === `low`).length,
          }
          process.stdout.write(`\n${severityTag(`high` as Severity)} ${counts.high}  ${severityTag(`medium` as Severity)} ${counts.medium}  ${severityTag(`low` as Severity)} ${counts.low}\n`)
        }
        process.stdout.write(`\n${ui.dim(`来源 ${RULES_SOURCE_URL}`)}\n`)
      }

      if (failOn !== `none`) {
        const threshold = SEVERITY_WEIGHT[failOn as WechatRuleSeverity]
        if (report.issues.some(issue => SEVERITY_WEIGHT[issue.severity] >= threshold))
          process.exitCode = 1
      }
    })
}
