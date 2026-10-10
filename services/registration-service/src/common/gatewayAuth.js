// Trust boundary: a service only accepts traffic that carries the secret key the API Gateway adds.
// The gateway has already verified the JWT; services just read the identity headers it injected.
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

const hasValidKey = (req) => req.get('x-internal-key') === env.internalKey;

/** Mount on `/api`: rejects requests that did not come through the gateway and fills `req.user`. */
export const fromGateway = (req, res, next) => {
  if (!hasValidKey(req)) {
    throw unauthorized('Direct access is not allowed. Use the API Gateway.', 'GATEWAY_ONLY');
  }
  const id = req.get('x-user-id');
  const role = req.get('x-user-role');
  // req.user is null on public routes (register / login) where there is no token.
  req.user = id && role ? { id, role, email: req.get('x-user-email') } : null;
  next();
};

/** Mount on `/internal`: service-to-service calls (never routed by the gateway). */
export const internalAuth = (req, res, next) => {
  if (!hasValidKey(req)) throw unauthorized('Internal API key required.', 'INTERNAL_ONLY');
  next();
};
