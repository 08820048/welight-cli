#!/usr/bin/env node
import process from 'node:process'
import { run } from './cli'
import { ui } from './ui'

run(process.argv).catch((error: unknown) => {
  ui.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
