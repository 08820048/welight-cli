import type { WechatRuleSeverity } from '../engine/shared/types'
import { Command, Option } from 'clipanion'
import { scanWechatRules } from '../engine'
import { readInput } from '../io'
import { inferTitle } from '../publish'
import { RULES_DATA, RULES_SOURCE_URL, RULES_UPDATED_AT, RULES_VERSION } from '../rulesData'

const SEVERITY_WEIGHT: Record<WechatRuleSeverity, number> = { high: 3, medium: 2, low: 1 }
const SEVERITY_LABEL: Record<WechatRuleSeverity, string> = { high: `高`, medium: `中`, low: `低` }
const FAIL_ON = [`none`, `low`, `medium`, `high`] as const
type FailOn = (typeof FAIL_ON)[number]

export class LintCommand extends Command {
  static paths = [[`lint`]]

  static usage = Command.Usage({
    description: `扫描文章命中的公众号平台规则（可用于 CI 门禁）`,
    details: `
      使用内置的公众号平台规则库做本地关键词 / 正则扫描。
      命中是风险线索而非违规结论，语义类规则需人工复核。

      命中严重级别达到 --fail-on 阈值时以退出码 1 结束，方便接入 CI。
      文件参数传 "-" 时从 stdin 读取。
    `,
    examples: [
      [`扫描文章`, `$0 lint post.md`],
      [`JSON 输出`, `$0 lint post.md --json`],
      [`仅高危失败`, `$0 lint post.md --fail-on high`],
    ],
  })

  file = Option.String({ required: true })

  title = Option.String(`--title`, { description: `文章标题，默认从 front-matter / 一级标题推断` })

  json = Option.Boolean(`--json`, false, { description: `以 JSON 输出扫描报告` })

  failOn = Option.String(`--fail-on`, `high`, {
    description: `命中达到该级别时退出码为 1：none | low | medium | high`,
  })

  async execute(): Promise<number> {
    const failOn = (FAIL_ON as readonly string[]).includes(this.failOn) ? (this.failOn as FailOn) : `high`
    const markdown = await readInput(this.file)
    const title = this.title || inferTitle(markdown, ``)

    const report = scanWechatRules({ title, content: markdown }, RULES_DATA)

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    }
    else {
      const lines: string[] = []
      lines.push(`公众号规则检查`)
      lines.push(`规则库版本：${RULES_VERSION}（更新于 ${RULES_UPDATED_AT}）`)
      lines.push(`检查规则：${report.checkedRules} 条   命中：${report.issues.length} 处`)
      lines.push(``)

      if (report.issues.length === 0) {
        lines.push(`未发现命中项。`)
      }
      else {
        const sorted = [...report.issues].sort(
          (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
        )
        for (const issue of sorted) {
          const scope = issue.scope === `title` ? `标题` : `正文`
          lines.push(`[${SEVERITY_LABEL[issue.severity]}] ${issue.ruleTitle}（${issue.category} · ${scope}）`)
          lines.push(`  命中：${issue.span.text.replace(/\s+/g, ` `).slice(0, 80)}`)
          if (issue.patternNote)
            lines.push(`  说明：${issue.patternNote}`)
        }
        lines.push(``)
        const counts = {
          high: report.issues.filter(i => i.severity === `high`).length,
          medium: report.issues.filter(i => i.severity === `medium`).length,
          low: report.issues.filter(i => i.severity === `low`).length,
        }
        lines.push(`高危 ${counts.high} · 中危 ${counts.medium} · 低危 ${counts.low}`)
      }
      lines.push(``)
      lines.push(`规则来源：${RULES_SOURCE_URL}`)
      lines.push(`提示：命中为本地确定性匹配的线索，不等同于违规结论。`)
      this.context.stdout.write(`${lines.join(`\n`)}\n`)
    }

    if (failOn === `none`)
      return 0
    const threshold = SEVERITY_WEIGHT[failOn as WechatRuleSeverity]
    const failed = report.issues.some(issue => SEVERITY_WEIGHT[issue.severity] >= threshold)
    return failed ? 1 : 0
  }
}
