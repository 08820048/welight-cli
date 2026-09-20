/**
 * 基于 Ink 的逐步交互提示（用于 setup 向导与 auth set）。
 * 每个提示独立 mount/unmount，输出保留在终端上。
 */

import type { ReactNode } from 'react'
import { ConfirmInput, PasswordInput, Select, TextInput } from '@inkjs/ui'
import { Box, Text, render, useApp } from 'ink'
import { isTui } from './runtime'

function Frame({ message, children }: { message: string, children: ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan">{message}</Text>
      {children}
    </Box>
  )
}

/** 文本输入；非 TTY 返回 null（表示跳过） */
export async function askText(message: string, placeholder?: string): Promise<string | null> {
  if (!isTui())
    return null
  return new Promise<string | null>((resolve) => {
    function Prompt() {
      const { exit } = useApp()
      return (
        <Frame message={message}>
          <TextInput
            placeholder={placeholder}
            onSubmit={(value) => {
              exit()
              resolve((value ?? ``).trim())
            }}
          />
        </Frame>
      )
    }
    render(<Prompt />)
  })
}

/** 密钥输入（不回显）；非 TTY 返回 null */
export async function askPassword(message: string): Promise<string | null> {
  if (!isTui())
    return null
  return new Promise<string | null>((resolve) => {
    function Prompt() {
      const { exit } = useApp()
      return (
        <Frame message={message}>
          <PasswordInput
            onSubmit={(value) => {
              exit()
              resolve((value ?? ``).trim())
            }}
          />
        </Frame>
      )
    }
    render(<Prompt />)
  })
}

/** 选择列表；取消返回 null */
export async function askSelect(message: string, options: Array<{ label: string, value: string }>): Promise<string | null> {
  if (!isTui())
    return null
  return new Promise<string | null>((resolve) => {
    function Prompt() {
      const { exit } = useApp()
      return (
        <Frame message={message}>
          <Select
            options={options}
            onChange={(value) => {
              exit()
              resolve(String(value))
            }}
          />
        </Frame>
      )
    }
    render(<Prompt />)
  })
}

/** 是否确认 */
export async function askConfirm(message: string): Promise<boolean> {
  if (!isTui())
    return false
  return new Promise<boolean>((resolve) => {
    function Prompt() {
      const { exit } = useApp()
      return (
        <Frame message={message}>
          <ConfirmInput
            onConfirm={() => {
              exit()
              resolve(true)
            }}
            onCancel={() => {
              exit()
              resolve(false)
            }}
          />
        </Frame>
      )
    }
    render(<Prompt />)
  })
}
