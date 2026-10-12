// Audit & Logging Service - read side (Admin only; the routes enforce this).
import AuditLog from '../models/AuditLog.js';
import { ok } from '../common/response.js';
import { badRequest, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value, field, { endOfDay = false } = {}) => {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid ISO date`);
  // "to=2026-10-12" should include the whole day, not stop at 00:00.
  if (endOfDay && DATE_ONLY_RE.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
};

const stringParam = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} must be a non-empty string`);
  return value.trim();
};

// GET /api/audit/logs  (Admin)
// Filters: ?actorId= ?action= ?service= ?outcome=success|failure ?from= ?to=. Security view = ?outcome=failure
export const listLogs = async (req, res) => {
  const { actorId, action, service, outcome, from, to } = req.query;
  const filter = {};

  if (actorId !== undefined) filter.actorId = stringParam(actorId, 'actorId');
  if (action !== undefined) filter.action = stringParam(action, 'action');
  if (service !== undefined) filter.service = stringParam(service, 'service');
  if (outcome !== undefined) {
    if (!['success', 'failure'].includes(outcome)) throw badRequest('outcome must be success or failure');
    filter.outcome = outcome;
  }

  const range = {};
  if (from !== undefined) range.$gte = parseDate(from, 'from');
  if (to !== undefined) range.$lte = parseDate(to, 'to', { endOfDay: true });
  if (range.$gte && range.$lte && range.$gte > range.$lte) throw badRequest('from must not be after to');
  if (Object.keys(range).length) filter.timestamp = range;

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/audit/logs/:id  (Admin)
export const getLog = async (req, res) => {
  const log = await AuditLog.findById(req.params.id);
  if (!log) throw notFound('Audit log not found');
  return ok(res, log);
};
