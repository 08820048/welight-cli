import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createCli } from '../src/cli'
import { displayWidth, welcomeScreen } from '../src/welcome'

const program = createCli()

function withColumns(columns: number, run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, `columns`)
  Object.defineProperty(process.stdout, `columns`, { value: columns, configurable: true })
  try {
    run()
  }
  finally {
    if (descriptor)
      Object.defineProperty(process.stdout, `columns`, descriptor)
    else
      delete (process.stdout as { columns?: number }).columns
  }
}

describe(`启动页`, () => {
  it(`宽终端使用左右分栏`, () => {
    withColumns(120, () => {
      const output = welcomeScreen(program, `0.0.1`)
      expect(output).toContain(`╭`)
      expect(output).toContain(`chat`)
      expect(output).toContain(`Welight CLI`)
      expect(output).toContain(`v0.0.1`)
    })
  })

  it(`窄终端退化为堆叠`, () => {
    withColumns(60, () => {
      const output = welcomeScreen(program, `0.0.1`)
      expect(output).not.toContain(`╭`)
      expect(output).toContain(`chat`)
    })
  })

  it(`双宽字符按 2 列计算`, () => {
    expect(displayWidth(`abc`)).toBe(3)
    expect(displayWidth(`中文`)).toBe(4)
  })
})
