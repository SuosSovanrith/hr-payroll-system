// Audit & Logging Service - read side (Admin only).
import { notImplemented } from '../common/errors.js';

// TODO [Member 3] GET /api/audit/logs  (Admin only)
//  Filters (all optional): ?actorId=, ?action=, ?service=, ?outcome=success|failure, ?from=ISO-date, ?to=ISO-date.
//  Security view = ?outcome=failure (failed logins, 401/403 attempts).
//  Paginate with getPagination (default limit 20), sort by timestamp desc, respond { items, page, limit, total }.
export const listLogs = async (req, res) => {
  throw notImplemented('GET /api/audit/logs');
};

// TODO [Member 3] GET /api/audit/logs/:id  (Admin only)  -> one log entry, 404 if missing.
export const getLog = async (req, res) => {
  throw notImplemented('GET /api/audit/logs/:id');
};
