import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configSchema } from '../src/config'
import { recallTheme, rememberTheme, resolveArticleTheme } from '../src/themeMemory'

let dir = ``
let prevHome: string | undefined
let md = ``

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), `wl-theme-`))
  prevHome = process.env.WELIGHT_HOME
  process.env.WELIGHT_HOME = dir
  md = path.join(dir, `post.md`)
  fs.writeFileSync(md, `# t`)
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  if (prevHome === undefined)
    delete process.env.WELIGHT_HOME
  else
    process.env.WELIGHT_HOME = prevHome
})

describe(`theme memory`, () => {
  it(`remember + recall`, () => {
    rememberTheme(md, `w011`)
    expect(recallTheme(md)).toBe(`w011`)
  })

  it(`优先级：flag > 记忆 > 配置`, () => {
    const config = configSchema.parse({ theme: `w001` })
    expect(resolveArticleTheme(config, md)).toEqual({ theme: `w001`, fromMemory: false })
    rememberTheme(md, `w011`)
    expect(resolveArticleTheme(config, md)).toEqual({ theme: `w011`, fromMemory: true })
    expect(resolveArticleTheme(config, md, `w014`)).toEqual({ theme: `w014`, fromMemory: false })
  })

  it(`stdin 不记忆`, () => {
    rememberTheme(`-`, `w011`)
    expect(recallTheme(`-`)).toBeUndefined()
  })
})
