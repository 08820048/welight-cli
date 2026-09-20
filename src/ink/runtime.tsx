/**
 * Ink 运行时：命令组件 + 非交互降级。
 *
 * - 交互终端（TTY）下用 Ink 渲染组件；管道 / CI / --json 场景直接走纯文本输出。
 * - WELIGHT_FORCE_TUI=1 可强制走 Ink（便于在非 TTY 下调试）。
 */

import type { ReactNode } from 'react'
import process from 'node:process'
import { Alert, Spinner } from '@inkjs/ui'
import { Box, Text, render, useApp } from 'ink'
import { useEffect, useState } from 'react'
import { ui as plainUi } from '../ui'

export function isTui(): boolean {
  if (process.env.WELIGHT_FORCE_TUI === `1`)
    return true
  return Boolean(process.stdout.isTTY)
}

interface CommandRunnerProps<T> {
  run: () => Promise<T>
  render: (data: T) => ReactNode
  onError?: (message: string) => void
  onData?: (data: T) => void
}

function CommandRunner<T>({ run, render: renderResult, onError, onData }: CommandRunnerProps<T>) {
  const { exit } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    run()
      .then((result) => {
        if (!cancelled) {
          onData?.(result)
          setData(result)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (data !== null || error !== null) {
      const timer = setTimeout(() => exit(), 0)
      return () => clearTimeout(timer)
    }
  }, [data, error, exit])

  if (error !== null) {
    onError?.(error)
    return (
      <Box marginTop={1}>
        <Alert variant="error" title="出错了">
          {error}
        </Alert>
      </Box>
    )
  }
  if (data === null)
    return <Spinner label="处理中…" />
  return <>{renderResult(data)}</>
}

/**
 * 执行一个命令：
 * - TTY：Ink 渲染（带 spinner），结束后退出；
 * - 非 TTY：运行 run，然后调用 plain 输出纯文本（可管道 / CI）。
 */
export async function executeCommand<T>(options: {
  run: () => Promise<T>
  render: (data: T) => ReactNode
  plain: (data: T) => void
  onError?: (message: string) => void
}): Promise<T | undefined> {
  if (!isTui()) {
    try {
      const data = await options.run()
      options.plain(data)
      return data
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.onError)
        options.onError(message)
      else
        plainUi.error(message)
      process.exitCode = 1
      return undefined
    }
  }

  let captured: T | undefined
  const { waitUntilExit } = render(
    <CommandRunner
      run={options.run}
      render={options.render}
      onError={options.onError}
      onData={(data) => {
        captured = data
      }}
    />,
  )
  await waitUntilExit()
  return captured
}

/** 自定义 Ink 界面（setup / ai 对话等） */
export function renderTui(node: ReactNode): ReturnType<typeof render> {
  return render(<>{node}</>)
}
