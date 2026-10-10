import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { ok } from '../common/response.js';
import { unauthorized, forbidden, badRequest } from '../common/errors.js';
import { sendAudit } from '../common/audit.js';

const audit = (req, action, user, outcome, statusCode) =>
  sendAudit({
    actorId: user?.id, actorRole: user?.role, action, resource: 'auth', method: req.method,
    path: req.originalUrl, statusCode, outcome, ip: req.ip, details: { email: req.body?.email },
  });

// ✅ DONE (reference implementation) - POST /api/auth/login  (public)
// Returns a JWT: { sub: userId, role, email }. The gateway verifies it on every later request.
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') throw badRequest('email and password must be strings');

  const user = await User.findOne({ email: email.toLowerCase() });
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));

  // Same message for "unknown email" and "wrong password" so attackers cannot discover which emails exist.
  if (!passwordOk) {
    audit(req, 'LOGIN_FAILED', user, 'failure', 401);
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    audit(req, 'LOGIN_BLOCKED', user, 'failure', 403);
    throw forbidden('This account has been deactivated', 'ACCOUNT_DISABLED');
  }

  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  });

  audit(req, 'LOGIN_SUCCESS', user, 'success', 200);
  return ok(res, { token, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn, user }, 'Login successful');
};

// ✅ DONE (reference implementation) - GET /api/auth/me  (any logged-in user)
// Re-reads the user from the DB so a deactivated user or a changed role is noticed immediately.
export const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.isActive) throw unauthorized('Account no longer exists or is deactivated', 'ACCOUNT_DISABLED');
  return ok(res, user);
};

// TODO [Common] (optional, only if time allows) POST /api/auth/change-password  (any logged-in user)
//  Body { oldPassword, newPassword } -> verify old with bcrypt.compare, hash new, save, sendAudit('PASSWORD_CHANGED').
//  If you add it: also add the rule to api-gateway/src/config/routes.js and document it in the README.
