import { buildContainer } from './container.js';
import { env } from './config/env.js';
import { logger } from './infrastructure/logging/logger.js';
import { createApp } from './infrastructure/http/app.js';

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ByteMarket API listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(() => {
    void container
      .close()
      .catch((error: unknown) => logger.error({ err: error }, 'Error closing database'))
      .finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
