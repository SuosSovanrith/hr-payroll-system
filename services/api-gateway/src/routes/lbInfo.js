// GET /api/lb-info (public) - load-balancing demo.
// The load balancer sends each request to a different gateway instance. The response shows which one answered.
//   Redis mode (Compose/EC2): all gateways increment the SAME Redis counter, so the counts are shared.
//   Memory mode (Kubernetes, REDIS_DISABLED=true): each pod counts its own hits; the changing pod name
//   in `servedBy` is the proof of load balancing.
import os from 'node:os';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { ok } from '../common/response.js';
import { AppError } from '../common/errors.js';

const memoryHits = {}; // only used when Redis is disabled

export const lbInfo = async (req, res) => {
  const servedBy = os.hostname(); // docker-compose: gw1 / gw2. Kubernetes: the pod name

  if (env.redisDisabled) {
    memoryHits[servedBy] = (memoryHits[servedBy] || 0) + 1;
    return ok(
      res,
      { servedBy, hits: { ...memoryHits }, total: memoryHits[servedBy], storage: 'in-memory (this pod only)' },
      'Load balancing info',
    );
  }

  if (!redis.isReady) throw new AppError(503, 'REDIS_UNAVAILABLE', 'Redis is not connected yet');
  await redis.hIncrBy('lb:hits', servedBy, 1);

  const raw = await redis.hGetAll('lb:hits');
  const hits = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
  const total = Object.values(hits).reduce((a, b) => a + b, 0);

  return ok(res, { servedBy, hits, total }, 'Load balancing info');
};
