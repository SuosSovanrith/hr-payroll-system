// Redis is used for ONE thing: a shared hit counter that proves load balancing (see routes/lbInfo.js).
import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redis = createClient({ url: env.redisUrl });
redis.on('error', (err) => console.error(`[redis] ${err.message}`));

// Not awaited on purpose: the gateway keeps working (except /api/lb-info) while Redis is still starting.
export const connectRedis = () => redis.connect().catch((err) => console.error(`[redis] connect failed: ${err.message}`));
