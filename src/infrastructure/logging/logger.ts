import { pino } from 'pino';

import { env } from '../../config/env.js';

/**
 * Application-wide structured logger.
 *
 * Production emits newline-delimited JSON (machine-readable for Render logs);
 * development uses `pino-pretty` for human-readable output. Tests are forced to
 * `silent` so suites stay deterministic and the reporter output is not drowned
 * out — the same reasoning that disables rate limiting under `NODE_ENV=test`.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    remove: true,
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
