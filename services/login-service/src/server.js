import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

try {
  await connectDB();
} catch (err) {
  // Exit so Docker (restart: on-failure) retries instead of running without a database.
  console.error(`[${env.serviceName}] MongoDB connection failed:`, err.message);
  process.exit(1);
}

const server = app.listen(env.port, () => {
  console.log(`[${env.serviceName}] listening on port ${env.port}`);
});

// Graceful shutdown so `docker stop` finishes in-flight requests.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
