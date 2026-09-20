#!/usr/bin/env node
import process from 'node:process'
import { run } from './cli'

run(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`welight: ${message}\n`)
  process.exitCode = 1
})
