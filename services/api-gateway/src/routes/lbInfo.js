// GET /api/lb-info (public) - load-balancing demo.
// Nginx sends each request to gateway1 or gateway2. Both increment a counter in the SAME Redis,
// so the response shows which instance answered and that the counts are shared.
import os from 'node:os';
import { redis } from '../lib/redis.js';
import { ok } from '../common/response.js';
import { AppError } from '../common/errors.js';

export const lbInfo = async (req, res) => {
  if (!redis.isReady) throw new AppError(503, 'REDIS_UNAVAILABLE', 'Redis is not connected yet');

  const servedBy = os.hostname(); // set to gw1 / gw2 via `hostname:` in docker-compose
  await redis.hIncrBy('lb:hits', servedBy, 1);

  const raw = await redis.hGetAll('lb:hits');
  const hits = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
  const total = Object.values(hits).reduce((a, b) => a + b, 0);

  return ok(res, { servedBy, hits, total }, 'Load balancing info');
};
