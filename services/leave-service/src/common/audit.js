// Fire-and-forget audit event -> Audit Service. Never blocks or breaks the real request.
// Event fields: actorId, actorRole, action, resource, resourceId, method, path, statusCode, outcome ('success'|'failure'), ip, details
import { env } from '../config/env.js';

export const sendAudit = (event) => {
  if (!env.auditServiceUrl) return; // audit not configured (e.g. running one service alone)
  fetch(`${env.auditServiceUrl}/internal/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': env.internalKey },
    body: JSON.stringify({ service: env.serviceName, ...event }),
    signal: AbortSignal.timeout(3000),
  }).catch((err) => console.warn(`[audit] could not send event: ${err.message}`));
};
