// Bootstrap: build the DI context (seeds store / DB), assemble the app, listen, shut down gracefully.
import { buildContext } from './context.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './repositories/postgres/PgPool.js';

const ctx = await buildContext();
const app = createApp(ctx);

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`oneCitizen API listening on :${env.PORT} [${env.NODE_ENV}] (driver=${ctx.driver})`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} received — shutting down`);
  server.close(async () => {
    await closePool().catch(() => {}); // release the pg pool if the postgres driver is active
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
