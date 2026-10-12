// Leave Management Service. Models: LeaveRequest, LeaveBalance (both in ./models).
import { badRequest, conflict, notImplemented } from '../common/errors.js';
import { ok, created } from '../common/response.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest, { LEAVE_TYPES } from '../models/LeaveRequest.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Finds this user's balance for a year, creating it with the schema defaults (14 annual / 7 sick) the first time.
const getOrCreateBalance = (userId, year) =>
  LeaveBalance.findOneAndUpdate(
    { userId, year },
    { $setOnInsert: { userId, year } },
    { upsert: true, new: true },
  );

// Parses a date and cuts it to midnight UTC so "2026-10-20" and "2026-10-20T15:00:00Z" count as the same day.
// Returns null when the value is not a valid date.
const toUtcDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// POST /api/leaves  (any logged-in user)   Body: { type, startDate, endDate, reason }
// Validates, rejects overlaps (409) and insufficient balance (400), then creates a 'pending' request (201).
// The balance is only deducted later, when HR/Admin approves.
export const requestLeave = async (req, res) => {
  const { type, startDate, endDate, reason } = req.body; // whitelist: nothing else from the body is used

  if (!LEAVE_TYPES.includes(type)) {
    throw badRequest('Invalid leave type', [{ field: 'type', message: `must be one of: ${LEAVE_TYPES.join(', ')}` }]);
  }

  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  if (!start || !end) throw badRequest('startDate and endDate must be valid dates');
  if (end < start) throw badRequest('endDate must be on or after startDate');

  const days = Math.round((end - start) / MS_PER_DAY) + 1; // inclusive: same day = 1

  // Two ranges overlap when each one starts on or before the other one ends.
  const overlapping = await LeaveRequest.findOne({
    userId: req.user.id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlapping) throw conflict('This overlaps with another pending or approved leave request');

  // Unpaid leave has no balance, so only annual/sick are checked.
  if (type !== 'unpaid') {
    const balance = await getOrCreateBalance(req.user.id, start.getUTCFullYear());
    const remaining = balance[type].allocated - balance[type].used;
    if (remaining < days) {
      throw badRequest(`Insufficient leave balance: ${days} day(s) requested, ${remaining} ${type} day(s) remaining`);
    }
  }

  const leave = await LeaveRequest.create({
    userId: req.user.id, // from the gateway headers, never from the body
    type,
    startDate: start,
    endDate: end,
    days,
    reason,
  });
  return created(res, leave);
};

// TODO [Member 2] GET /api/leaves/me  (any logged-in user)  -> own requests, newest first, optional ?status=
export const myLeaves = async (req, res) => {
  throw notImplemented('GET /api/leaves/me');
};

// TODO [Member 2] GET /api/leaves  (HR, Admin)  -> all requests
//  Filters: ?status=, ?userId=. Paginate with getPagination -> { items, page, limit, total }.
export const listLeaves = async (req, res) => {
  throw notImplemented('GET /api/leaves');
};

// TODO [Member 2] PATCH /api/leaves/:id/review  (HR, Admin)   Body: { decision: 'approved' | 'rejected', comment }
//  1. decision must be one of the two values -> else 400. Request not found -> 404.
//  2. Only 'pending' requests can be reviewed -> else 409.
//  3. Nobody may review their OWN request (request.userId === req.user.id) -> 403.
//  4. On 'approved' for annual/sick: balance[type].used += days (use $inc so it is atomic).
//  5. Save status, reviewedBy = req.user.id, reviewComment; sendAudit({ action: 'LEAVE_APPROVED' | 'LEAVE_REJECTED', ... }).
export const reviewLeave = async (req, res) => {
  throw notImplemented('PATCH /api/leaves/:id/review');
};

// TODO [Member 2] DELETE /api/leaves/:id  (owner only)  -> cancel
//  1. Not found -> 404; request.userId !== req.user.id -> 403; status !== 'pending' -> 409.
//  2. Set status = 'cancelled' (keep the record) and respond ok.
export const cancelLeave = async (req, res) => {
  throw notImplemented('DELETE /api/leaves/:id');
};

// GET /api/leaves/balance/me  (any logged-in user)
// Creates the balance with the schema defaults on first use, then returns { year, annual, sick } with `remaining`.
export const myBalance = async (req, res) => {
  const year = new Date().getFullYear();
  const balance = await getOrCreateBalance(req.user.id, year);
  const bucket = (b) => ({ allocated: b.allocated, used: b.used, remaining: b.allocated - b.used });
  return ok(res, { year, annual: bucket(balance.annual), sick: bucket(balance.sick) });
};