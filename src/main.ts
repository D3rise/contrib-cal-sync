#!/usr/bin/env node
import { runCli } from './cli.js'
import { createCliDependencies } from './runtime.js'

process.exitCode = await runCli(process.argv.slice(2), createCliDependencies())
