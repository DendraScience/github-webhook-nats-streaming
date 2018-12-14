#!/usr/bin/env node

/**
 * GitHub Webhook to NATS Streaming CLI entry point.
 *
 * @author J. Scott Smith
 * @license BSD-2-Clause-FreeBSD
 * @module github-webhook-nats-streaming
 */

const os = require('os')
const mri = require('mri')

const log = console

process.on('uncaughtException', err => {
  log.error(`An unexpected error occurred\n  ${err.stack}`)
  process.exit(1)
})

process.on('unhandledRejection', err => {
  if (!err) {
    log.error('An unexpected empty rejection occurred')
  } else if (err instanceof Error) {
    log.error(`An unexpected rejection occurred\n  ${err.stack}`)
  } else {
    log.error(`An unexpected rejection occurred\n  ${err}`)
  }
  process.exit(1)
})

// TODO: Handle SIGTERM gracefully for Docker
// SEE: http://joseoncode.com/2014/07/21/graceful-shutdown-in-node-dot-js/
require('./app')(log).then(app => {
  const args = process.argv.slice(2)
  const parsed = mri(args, {
    alias: {
      stan_client: 'stan-client',
      stan_cluster: 'stan-cluster',
      stan_uri: 'stan-uri',
      task_seconds: 'task-seconds'
    },
    default: {
      port: 3000,
      stan_client: os.hostname(),
      stan_cluster: 'test-cluster',
      stan_uri: 'http://localhost:4222',
      subject: 'github.webhook',
      task_seconds: 30
    },
    string: [
      'secret',
      'stan_client',
      'stan_cluster',
      'stan_uri',
      'subject'
    ]
  })

  return app.eval(parsed)
})
