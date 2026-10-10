import AuditLog from '../models/AuditLog.js';
import { created } from '../common/response.js';
import { badRequest } from '../common/errors.js';

// Only these fields are accepted from callers (never trust arbitrary keys).
const ALLOWED = ['actorId', 'actorRole', 'action', 'service', 'resource', 'resourceId', 'method', 'path', 'statusCode', 'outcome', 'ip', 'details'];

// ✅ DONE - POST /internal/logs  (service-to-service; called by the Gateway, Login and Registration via common/audit.js)
// Any service can also call sendAudit() to record its own business events.
// TODO [Member 3] (optional) Add a TTL index on `timestamp` in the model if you want old logs to expire automatically.
export const createLog = async (req, res) => {
  const data = Object.fromEntries(ALLOWED.filter((k) => req.body?.[k] !== undefined).map((k) => [k, req.body[k]]));
  if (!data.action) throw badRequest('action is required');
  const log = await AuditLog.create(data);
  return created(res, { id: log.id });
};
