import { notImplemented } from '../common/errors.js';

// TODO [Common] GET /api/users  (HR, Admin)
//  1. Optional filters: ?role=, ?isActive=true|false, ?search= (email or fullName, case-insensitive regex).
//  2. Pagination: const { page, limit, skip } = getPagination(req.query)  (common/pagination.js).
//  3. User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit); respond ok(res, { items, page, limit, total }).
export const listUsers = async (req, res) => {
  throw notImplemented('GET /api/users');
};

// TODO [Common] PATCH /api/users/:id/role  (Admin only)
//  1. Body: { role } must be in ALL_ROLES -> else 400. User not found -> 404.
//  2. An admin must not be able to demote THEMSELVES (req.user.id === req.params.id) -> 400.
//  3. Update, then sendAudit({ action: 'ROLE_CHANGED', actorId, resourceId, details: { from, to }, ... }).
//  Bonus (optional): also accept { isActive } to deactivate/reactivate an account.
export const changeRole = async (req, res) => {
  throw notImplemented('PATCH /api/users/:id/role');
};
