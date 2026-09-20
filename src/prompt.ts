/**
 * 交互式输入工具（仅 TTY）。密钥输入走不可见模式，不回显、不进日志。
 */

import process from 'node:process'
import readline from 'node:readline'

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/** 普通文本输入 */
export function promptText(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** 密钥输入：不回显；回车确认，Ctrl+C 取消 */
export function promptSecret(question: string): Promise<string> {
  if (!isInteractive())
    return Promise.reject(new Error(`当前不是交互终端，无法安全输入密钥`))

  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    process.stdout.write(question)
    stdin.setRawMode?.(true)
    stdin.resume()

    let value = ``
    let done = false

    const finish = (fn: () => void) => {
      if (done)
        return
      done = true
      stdin.removeListener(`data`, onData)
      stdin.setRawMode?.(wasRaw ?? false)
      stdin.pause()
      fn()
    }

    const onData = (buffer: Buffer) => {
      for (const char of buffer.toString(`utf8`)) {
        if (char === `\r` || char === `\n`) {
          process.stdout.write(`\n`)
          finish(() => resolve(value.trim()))
          return
        }
        if (char === `\u0003`) {
          process.stdout.write(`\n`)
          finish(() => reject(new Error(`已取消`)))
          return
        }
        if (char === `\u007F` || char === `\b`) {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }

    stdin.on(`data`, onData)
  })
}
