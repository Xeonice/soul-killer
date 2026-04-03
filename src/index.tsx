#!/usr/bin/env bun
import { render } from 'ink'
import React from 'react'
import { App } from './cli/app.js'

const { waitUntilExit } = render(<App />)
await waitUntilExit()
