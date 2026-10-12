// Leave Management Service. Models: LeaveRequest, LeaveBalance (both in ./models).
// req.user = { id, role, email } is filled from the gateway headers.
import LeaveRequest, { LEAVE_TYPES } from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { ok, created } from '../common/response.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const BALANCE_TYPES = ['annual', 'sick']; // unpaid leave has no balance
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Parse "YYYY-MM-DD" or any ISO string into a Date at 00:00 UTC of that calendar day.
const toUtcDay = (value, field) => {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid date`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Returns the user's balance for a year, creating it with the schema defaults the first time.
const getOrCreateBalance = async (userId, year) => {
  const run = () =>
    LeaveBalance.findOneAndUpdate(
      { userId, year },
      { $setOnInsert: { userId, year } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  try {
    return await run();
  } catch (err) {
    if (err?.code === 11000) return run(); // two requests created it at the same moment: read the winner
    throw err;
  }
};

const bucketView = (b) => ({ allocated: b.allocated, used: b.used, remaining: b.allocated - b.used });

// POST /api/leaves  (any logged-in user)   Body: { type, startDate, endDate, reason }
export const requestLeave = async (req, res) => {
  const { type, startDate, endDate, reason } = req.body;

  if (!LEAVE_TYPES.includes(type)) throw badRequest(`type must be one of: ${LEAVE_TYPES.join(', ')}`);
  if (reason !== undefined && typeof reason !== 'string') throw badRequest('reason must be a string');

  const start = toUtcDay(startDate, 'startDate');
  const end = toUtcDay(endDate, 'endDate');
  if (end < start) throw badRequest('endDate must not be before startDate');

  const days = Math.round((end - start) / MS_PER_DAY) + 1; // inclusive
  const year = start.getUTCFullYear();

  // Balance is tracked per calendar year, so annual/sick requests must stay inside one year.
  if (BALANCE_TYPES.includes(type) && end.getUTCFullYear() !== year) {
    throw badRequest('Annual and sick leave cannot span two calendar years. Submit one request per year');
  }

  const overlap = await LeaveRequest.exists({
    userId: req.user.id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) throw conflict('You already have a pending or approved leave request in this period');

  if (BALANCE_TYPES.includes(type)) {
    const balance = await getOrCreateBalance(req.user.id, year);
    const remaining = balance[type].allocated - balance[type].used;
    if (remaining < days) {
      throw badRequest(`Insufficient ${type} leave balance: ${remaining} day(s) remaining, ${days} requested`);
    }
  }

  const request = await LeaveRequest.create({
    userId: req.user.id, type, startDate: start, endDate: end, days, reason: reason?.trim(), status: 'pending',
  });
  return created(res, request, 'Leave request submitted');
};

// GET /api/leaves/me  (any logged-in user)  -> own requests, newest first, optional ?status=
export const myLeaves = async (req, res) => {
  const { status } = req.query;
  const filter = { userId: req.user.id };
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
    filter.status = status;
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/leaves  (HR, Admin)  -> all requests, filters ?status= ?userId=
export const listLeaves = async (req, res) => {
  const { status, userId } = req.query;
  const filter = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
    filter.status = status;
  }
  if (userId !== undefined) {
    if (typeof userId !== 'string' || !userId.trim()) throw badRequest('userId must be a string');
    filter.userId = userId.trim();
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// PATCH /api/leaves/:id/review  (HR, Admin)   Body: { decision: 'approved' | 'rejected', comment }
export const reviewLeave = async (req, res) => {
  const { decision, comment } = req.body;
  if (!['approved', 'rejected'].includes(decision)) throw badRequest('decision must be approved or rejected');
  if (comment !== undefined && typeof comment !== 'string') throw badRequest('comment must be a string');

  const existing = await LeaveRequest.findById(req.params.id);
  if (!existing) throw notFound('Leave request not found');
  if (existing.status !== 'pending') throw conflict(`Only pending requests can be reviewed (this one is ${existing.status})`);
  if (existing.userId === req.user.id) throw forbidden('You cannot review your own leave request');

  // Move pending -> decision atomically, so two reviewers cannot both decide the same request.
  const request = await LeaveRequest.findOneAndUpdate(
    { _id: existing._id, status: 'pending' },
    { $set: { status: decision, reviewedBy: req.user.id, reviewComment: comment?.trim() } },
    { new: true },
  );
  if (!request) throw conflict('This request was already reviewed');

  if (decision === 'approved' && BALANCE_TYPES.includes(request.type)) {
    const year = request.startDate.getUTCFullYear();
    await getOrCreateBalance(request.userId, year);

    const field = request.type; // 'annual' | 'sick'
    const deducted = await LeaveBalance.findOneAndUpdate(
      {
        userId: request.userId,
        year,
        // never let `used` exceed `allocated`, even if balance changed since the request was made
        $expr: { $lte: [{ $add: [`$${field}.used`, request.days] }, `$${field}.allocated`] },
      },
      { $inc: { [`${field}.used`]: request.days } },
      { new: true },
    );
    if (!deducted) {
      // Roll the decision back so the request can be reviewed again (or rejected).
      await LeaveRequest.updateOne(
        { _id: request._id },
        { $set: { status: 'pending' }, $unset: { reviewedBy: '', reviewComment: '' } },
      );
      throw conflict(`Cannot approve: not enough ${field} leave balance left for ${request.days} day(s)`);
    }
  }

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role,
    action: decision === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    resource: 'leave', resourceId: request.id, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success',
    details: { employeeId: request.userId, type: request.type, days: request.days },
  });
  return ok(res, request, `Leave request ${decision}`);
};

// DELETE /api/leaves/:id  (owner only)  -> cancel while pending
export const cancelLeave = async (req, res) => {
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) throw notFound('Leave request not found');
  if (request.userId !== req.user.id) throw forbidden('You can only cancel your own leave requests');
  if (request.status !== 'pending') throw conflict(`Only pending requests can be cancelled (this one is ${request.status})`);

  const cancelled = await LeaveRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending' }, { $set: { status: 'cancelled' } }, { new: true },
  );
  if (!cancelled) throw conflict('This request was just reviewed and can no longer be cancelled');

  return ok(res, cancelled, 'Leave request cancelled');
};

// GET /api/leaves/balance/me  (any logged-in user)
export const myBalance = async (req, res) => {
  const year = new Date().getUTCFullYear();
  const balance = await getOrCreateBalance(req.user.id, year);
  return ok(res, { year, annual: bucketView(balance.annual), sick: bucketView(balance.sick) });
};
