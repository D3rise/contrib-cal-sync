#!/usr/bin/env node
import 'reflect-metadata'
import { CliController } from './presentation/cli/cli.controller.js'
import { createContainer } from './composition/container.js'

process.exitCode = await createContainer().get(CliController).execute(process.argv.slice(2))
