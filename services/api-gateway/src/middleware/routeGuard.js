// Core of the gateway: route lookup -> JWT validation -> role check -> inject trusted identity headers.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findRule } from '../config/routes.js';
import { notFound, unauthorized, forbidden } from '../common/errors.js';

// Headers a client must never be able to set themselves.
const TRUSTED_HEADERS = ['x-user-id', 'x-user-role', 'x-user-email', 'x-internal-key'];

const verifyToken = (req) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Missing Bearer token', 'NO_TOKEN');
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Token has expired', 'TOKEN_EXPIRED');
    throw unauthorized('Invalid token', 'INVALID_TOKEN');
  }
};

export const routeGuard = (req, res, next) => {
  TRUSTED_HEADERS.forEach((h) => delete req.headers[h]); // 1. strip spoofed headers

  const rule = findRule(req.method, req.path); // 2. is this route exposed at all?
  if (!rule) throw notFound(`Route ${req.method} ${req.path} not found`);
  req.rule = rule;

  if (!rule.public) {
    const payload = verifyToken(req); // 3. authentication (JWT)
    if (!rule.roles.includes(payload.role)) { // 4. authorization (RBAC)
      throw forbidden(`Role "${payload.role}" is not allowed to access this route`);
    }
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    req.headers['x-user-id'] = req.user.id; // 5. identity for downstream services
    req.headers['x-user-role'] = req.user.role;
    req.headers['x-user-email'] = req.user.email || '';
  }

  req.headers['x-internal-key'] = env.internalKey; // proves "this came through the gateway"
  next();
};
