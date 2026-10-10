import app from './app.js';
import { env } from './config/env.js';
import { connectRedis } from './lib/redis.js';

connectRedis();

const server = app.listen(env.port, () => {
  console.log(`[${env.serviceName}] listening on port ${env.port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
