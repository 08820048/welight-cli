import { describe, expect, it } from 'vitest'
import { createCli } from '../src/cli'
import { selectableCommands } from '../src/launcher'

const names = selectableCommands(createCli()).map(command => command.name())

describe(`交互式启动器命令列表`, () => {
  it(`排除内部与 help 命令`, () => {
    expect(names).not.toContain(`__complete`)
    expect(names).not.toContain(`help`)
  })

  it(`包含常用命令`, () => {
    expect(names).toContain(`chat`)
    expect(names).toContain(`render`)
    expect(names).toContain(`publish`)
  })
})
