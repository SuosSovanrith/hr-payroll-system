import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ROLES, ALL_ROLES } from '../common/roles.js';
import { created } from '../common/response.js';
import { badRequest, conflict } from '../common/errors.js';
import { sendAudit } from '../common/audit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared by register and registerStaff: validate, check duplicate, hash the password, save.
const createUser = async ({ email, password, fullName, role }) => {
  if ([email, password, fullName].some((v) => typeof v !== 'string')) {
    throw badRequest('email, password and fullName must be strings');
  }
  if (!EMAIL_RE.test(email)) throw badRequest('Invalid email format');
  if (password.length < 6) throw badRequest('Password must be at least 6 characters');
  if (await User.exists({ email: email.toLowerCase() })) throw conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ email, passwordHash, fullName, role });
};

// DONE (reference implementation) - POST /api/auth/register  (public)
// Anyone can sign up, but the role is ALWAYS employee (ignore any "role" sent by the client).
export const register = async (req, res) => {
  const { email, password, fullName } = req.body;
  const user = await createUser({ email, password, fullName, role: ROLES.EMPLOYEE });

  sendAudit({
    actorId: user.id, actorRole: user.role, action: 'USER_REGISTERED', resource: 'user', resourceId: user.id,
    method: req.method, path: req.originalUrl, statusCode: 201, outcome: 'success',
  });
  return created(res, user, 'Registration successful');
};

// TODO [Common] POST /api/auth/register/staff  (Admin only - gateway + route already enforce this)
//  1. Body: { email, password, fullName, role }. Check `role` is one of ALL_ROLES (common/roles.js) -> else 400.
//  2. Reuse createUser({ ..., role }) above, respond 201 with created(res, user).
//  3. sendAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'STAFF_ACCOUNT_CREATED', resourceId: user.id, ... }).

export const registerStaff = async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!ALL_ROLES.includes(role)) {
    throw badRequest(`role must be one of: ${ALL_ROLES.join(', ')}`);
  }

  const user = await createUser({ email, password, fullName, role });

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'STAFF_ACCOUNT_CREATED',
    resource: 'user', resourceId: user.id, method: req.method, path: req.originalUrl,
    statusCode: 201, outcome: 'success', details: { email: user.email, role: user.role },
  });
  return created(res, user, 'Staff account created');
};
