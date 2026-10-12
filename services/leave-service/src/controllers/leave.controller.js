// Leave Management Service. Models: LeaveRequest, LeaveBalance (both in ./models).
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { ok, created } from '../common/response.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest, { LEAVE_TYPES } from '../models/LeaveRequest.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const DECISIONS = ['approved', 'rejected'];

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

// Reads the optional ?status= filter; an unknown value is a 400 instead of a silently empty list.
const parseStatus = (value) => {
  if (value === undefined || value === '') return undefined;
  if (!STATUSES.includes(value)) {
    throw badRequest('Invalid status filter', [{ field: 'status', message: `must be one of: ${STATUSES.join(', ')}` }]);
  }
  return value;
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

// GET /api/leaves/me  (any logged-in user)  -> own requests, newest first, optional ?status=
export const myLeaves = async (req, res) => {
  const filter = { userId: req.user.id };
  const status = parseStatus(req.query.status);
  if (status) filter.status = status;

  const leaves = await LeaveRequest.find(filter).sort({ createdAt: -1 });
  return ok(res, leaves);
};

// GET /api/leaves  (HR, Admin)  -> all requests, filters ?status= ?userId=, paginated
export const listLeaves = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  const status = parseStatus(req.query.status);
  if (status) filter.status = status;
  if (req.query.userId) filter.userId = String(req.query.userId);

  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// PATCH /api/leaves/:id/review  (HR, Admin)   Body: { decision: 'approved' | 'rejected', comment }
// Only pending requests, never your own. Approving annual/sick leave deducts the balance.
export const reviewLeave = async (req, res) => {
  const { decision, comment } = req.body;
  if (!DECISIONS.includes(decision)) {
    throw badRequest('Invalid decision', [{ field: 'decision', message: `must be one of: ${DECISIONS.join(', ')}` }]);
  }

  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) throw notFound('Leave request not found');
  if (leave.status !== 'pending') throw conflict(`Only pending requests can be reviewed (this one is ${leave.status})`);
  if (leave.userId === req.user.id) throw forbidden('You cannot review your own leave request');

  // Balances are kept per year of the start date, the same year requestLeave checked.
  const deduct = decision === 'approved' && leave.type !== 'unpaid';
  const year = leave.startDate.getUTCFullYear();

  if (deduct) {
    const balance = await getOrCreateBalance(leave.userId, year);
    const remaining = balance[leave.type].allocated - balance[leave.type].used;
    if (remaining < leave.days) {
      throw conflict(`Cannot approve: ${leave.days} day(s) requested, only ${remaining} ${leave.type} day(s) remaining`);
    }
  }

  // Atomic status change: if two reviewers click at once, only one gets past 'pending' (no double deduction).
  const reviewed = await LeaveRequest.findOneAndUpdate(
    { _id: leave._id, status: 'pending' },
    { status: decision, reviewedBy: req.user.id, reviewComment: comment },
    { new: true, runValidators: true },
  );
  if (!reviewed) throw conflict('This request was already reviewed');

  if (deduct) {
    await LeaveBalance.updateOne(
      { userId: leave.userId, year },
      { $inc: { [`${leave.type}.used`]: leave.days } }, // $inc is atomic
    );
  }

  sendAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: decision === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    resource: 'leave_request',
    resourceId: String(reviewed._id),
    method: req.method,
    path: req.originalUrl,
    statusCode: 200,
    outcome: 'success',
    details: { userId: reviewed.userId, type: reviewed.type, days: reviewed.days, comment: reviewed.reviewComment },
  });

  return ok(res, reviewed, `Leave request ${decision}`);
};

// DELETE /api/leaves/:id  (owner only)  -> cancel a pending request (soft: the record is kept)
export const cancelLeave = async (req, res) => {
  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) throw notFound('Leave request not found');
  if (leave.userId !== req.user.id) throw forbidden('You can only cancel your own leave request');
  if (leave.status !== 'pending') throw conflict(`Only pending requests can be cancelled (this one is ${leave.status})`);

  const cancelled = await LeaveRequest.findOneAndUpdate(
    { _id: leave._id, status: 'pending' },
    { status: 'cancelled' },
    { new: true },
  );
  if (!cancelled) throw conflict('This request is no longer pending');
  return ok(res, cancelled, 'Leave request cancelled');
};

// GET /api/leaves/balance/me  (any logged-in user)
// Creates the balance with the schema defaults on first use, then returns { year, annual, sick } with `remaining`.
export const myBalance = async (req, res) => {
  const year = new Date().getFullYear();
  const balance = await getOrCreateBalance(req.user.id, year);
  const bucket = (b) => ({ allocated: b.allocated, used: b.used, remaining: b.allocated - b.used });
  return ok(res, { year, annual: bucket(balance.annual), sick: bucket(balance.sick) });
};
