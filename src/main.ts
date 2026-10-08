import { buildContainer } from './container.js';
import { env } from './config/env.js';
import { createApp } from './infrastructure/http/app.js';

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  console.log(`[ByteMarket API] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`[ByteMarket API] ${signal} received, shutting down`);
  server.close(() => {
    void container
      .close()
      .catch((error: unknown) => console.error('[ByteMarket API] error closing database', error))
      .finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
