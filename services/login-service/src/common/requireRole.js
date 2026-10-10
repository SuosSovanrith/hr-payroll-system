// Per-route authorization inside a service (second line of defence after the gateway's route table).
import { unauthorized, forbidden } from './errors.js';

/** Any logged-in user. */
export const requireAuth = (req, res, next) => {
  if (!req.user) throw unauthorized();
  next();
};

/** Only the listed roles, e.g. requireRole(ROLES.ADMIN) or requireRole(...STAFF). */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw unauthorized();
  if (!roles.includes(req.user.role)) throw forbidden(`Requires role: ${roles.join(' or ')}`);
  next();
};
