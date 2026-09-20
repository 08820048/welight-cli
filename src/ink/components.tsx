import type { ReactNode } from 'react'
import { Badge, StatusMessage } from '@inkjs/ui'
import { Box, Text } from 'ink'

export function Title({ children, subtitle }: { children: ReactNode, subtitle?: ReactNode }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">{children}</Text>
      {subtitle ? <Text dimColor>{subtitle}</Text> : null}
    </Box>
  )
}

export function KeyValueList({ rows }: { rows: Array<[string, string]> }) {
  const width = Math.max(0, ...rows.map(([label]) => label.length))
  return (
    <Box flexDirection="column">
      {rows.map(([label, value]) => (
        <Box key={label}>
          <Box width={width + 2} flexShrink={0}>
            <Text dimColor>{label}</Text>
          </Box>
          <Text>{value}</Text>
        </Box>
      ))}
    </Box>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{children}</Text>
    </Box>
  )
}

export function Success({ children }: { children: ReactNode }) {
  return <StatusMessage variant="success">{children}</StatusMessage>
}

export function Failure({ children }: { children: ReactNode }) {
  return <StatusMessage variant="error">{children}</StatusMessage>
}

export function Warning({ children }: { children: ReactNode }) {
  return <StatusMessage variant="warning">{children}</StatusMessage>
}

export function Info({ children }: { children: ReactNode }) {
  return <StatusMessage variant="info">{children}</StatusMessage>
}

export type Severity = `high` | `medium` | `low`

export function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === `high`)
    return <Badge color="red">高危</Badge>
  if (severity === `medium`)
    return <Badge color="yellow">中危</Badge>
  return <Badge color="gray">低危</Badge>
}
