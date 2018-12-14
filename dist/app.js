'use strict';

/**
 * GitHub Webhook to NATS Streaming CLI app.
 *
 * @author J. Scott Smith
 * @license BSD-2-Clause-FreeBSD
 * @module app
 */

const STAN = require('node-nats-streaming');
const WebhooksApi = require('@octokit/webhooks');

module.exports = async log => {
  const app = {
    taskSeconds: 0
  };

  const handleError = err => {
    log.error(`Task error\n  ${err}`);
  };

  const runTask = async () => {
    const { stan } = app;

    log.info('Task running...');

    if (!stan) return;
    if (stan.isConnected) return;
    if (stan.instance) stan.instance.removeAllListeners();

    log.info('NATS Streaming connecting');

    stan.instance = STAN.connect(stan.cluster, stan.client, stan.opts || {});
    stan.instance.once('close', () => {
      stan.isConnected = false;
      log.info('NATS Streaming closed');
    });
    stan.instance.once('connect', () => {
      stan.isConnected = true;
      log.info('NATS Streaming connected');
    });
    stan.instance.on('error', err => {
      log.error(`NATS Streaming error\n  ${err}`);
    });
  };

  const scheduleTask = () => {
    log.info(`Task starting in ${app.taskSeconds} seconds`);

    app.taskTid = setTimeout(() => {
      runTask().catch(handleError).then(scheduleTask);
    }, app.taskSeconds * 1000);
  };

  // App setup
  app.eval = async p => {
    if (!p.secret) throw new Error('Required: secret');

    app.stan = {
      cluster: p.stan_cluster,
      client: p.stan_client.replace(/\W/g, '_'),
      opts: {
        uri: p.stan_uri
      }
    };

    scheduleTask();

    app.taskSeconds = p.task_seconds;

    const webhooks = new WebhooksApi({
      secret: p.secret
    });

    webhooks.on('*', event => {
      const { id, name } = event;

      log.info(`Webhooks event received '${name}' ${id}`);

      try {
        app.stan.instance.publish(p.subject, JSON.stringify(event), (err, guid) => {
          if (err) {
            log.error(`Publish error\n  ${err}`);
          } else {
            log.info(`Event published '${name}' ${id} ${guid}`);
          }
        });
      } catch (err) {
        log.error(`Event handling error\n  ${err}`);
      }
    });
    webhooks.on('error', err => {
      if (err.event) {
        log.error(`Webhooks error in '${err.event.name}' ${err.event.id}\n  ${err.stack}`);
      } else {
        log.error(`Webhooks error\n  ${err.stack}`);
      }
    });

    app.server = require('http').createServer(webhooks.middleware).listen(p.port);
  };

  return app;
};