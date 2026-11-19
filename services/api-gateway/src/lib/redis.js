// Redis is used for ONE thing: a shared hit counter that proves load balancing (see routes/lbInfo.js).
// Midterm (Docker Compose / EC2): Redis is on. Final (Kubernetes): REDIS_DISABLED=true -> no Redis at all.
import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redis = env.redisDisabled ? null : createClient({ url: env.redisUrl });
redis?.on('error', (err) => console.error(`[redis] ${err.message}`));

// Not awaited on purpose: the gateway keeps working (except /api/lb-info) while Redis is still starting.
export const connectRedis = () => {
  if (!redis) {
    console.log('[redis] disabled (REDIS_DISABLED=true): /api/lb-info uses an in-memory counter');
    return;
  }
  return redis.connect().catch((err) => console.error(`[redis] connect failed: ${err.message}`));
};
