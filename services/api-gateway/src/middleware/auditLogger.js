// Sends an audit event after the response is sent for: every state-changing request (POST/PUT/PATCH/DELETE)
// and every 401/403 (security events). Must be registered BEFORE routeGuard so it also sees rejected requests.
import { sendAudit } from '../common/audit.js';

export const auditLogger = (req, res, next) => {
  res.on('finish', () => {
    const rule = req.rule; // undefined when the route is unknown
    if (rule?.audit === false) return;

    const denied = res.statusCode === 401 || res.statusCode === 403;
    const mutating = req.method !== 'GET' && rule;
    if (!denied && !mutating) return;

    sendAudit({
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: denied ? 'ACCESS_DENIED' : `${req.method} ${rule.path}`,
      resource: rule?.service,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      outcome: res.statusCode < 400 ? 'success' : 'failure',
      ip: req.ip,
    });
  });
  next();
};
