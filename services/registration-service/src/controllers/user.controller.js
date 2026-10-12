import User from '../models/User.js';
import { ALL_ROLES, ROLES } from '../common/roles.js';
import { ok } from '../common/response.js';
import { badRequest, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';

// DONE [Common] GET /api/users  (HR, Admin)
//  1. Optional filters: ?role=, ?isActive=true|false, ?search= (email or fullName, case-insensitive regex).
//  2. Pagination: const { page, limit, skip } = getPagination(req.query)  (common/pagination.js).
//  3. User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit); respond ok(res, { items, page, limit, total }).

// Escape regex characters so ?search=a.b* is treated as plain text, not a pattern.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listUsers = async (req, res) => {
  const { role, isActive, search } = req.query;
  const filter = {};

  if (role !== undefined) {
    if (!ALL_ROLES.includes(role)) throw badRequest(`role must be one of: ${ALL_ROLES.join(', ')}`);
    filter.role = role;
  }
  if (isActive !== undefined) {
    if (!['true', 'false'].includes(isActive)) throw badRequest('isActive must be true or false');
    filter.isActive = isActive === 'true';
  }
  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ email: rx }, { fullName: rx }];
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return ok(res, { items, page, limit, total });
};

// DONE [Common] PATCH /api/users/:id/role  (Admin only)
//  1. Body: { role } must be in ALL_ROLES -> else 400. User not found -> 404.
//  2. An admin must not be able to demote THEMSELVES (req.user.id === req.params.id) -> 400.
//  3. Update, then sendAudit({ action: 'ROLE_CHANGED', actorId, resourceId, details: { from, to }, ... }).
//  Bonus (optional): also accept { isActive } to deactivate/reactivate an account.

export const changeRole = async (req, res) => {
  const { role, isActive } = req.body;

  if (role === undefined && isActive === undefined) {
    throw badRequest('Provide role and/or isActive');
  }
  if (role !== undefined && !ALL_ROLES.includes(role)) {
    throw badRequest(`role must be one of: ${ALL_ROLES.join(', ')}`);
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw badRequest('isActive must be true or false');
  }

  // An admin must not lock themselves out.
  const isSelf = req.user.id === req.params.id;
  if (isSelf && role !== undefined && role !== ROLES.ADMIN) throw badRequest('You cannot demote yourself');
  if (isSelf && isActive === false) throw badRequest('You cannot deactivate yourself');

  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');

  const before = { role: user.role, isActive: user.isActive };
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role,
    action: role !== undefined ? 'ROLE_CHANGED' : 'ACCOUNT_STATUS_CHANGED',
    resource: 'user', resourceId: user.id, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success',
    details: { from: before, to: { role: user.role, isActive: user.isActive } },
  });
  return ok(res, user, 'User updated');
};
