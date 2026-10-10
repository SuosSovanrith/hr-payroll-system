// Service-to-service GET with the internal key. Returns the `data` field of the standard response.
// Example: const emp = await internalGet(`${env.employeeServiceUrl}/internal/employees/${userId}`);
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export const internalGet = async (url) => {
  let res;
  try {
    res = await fetch(url, { headers: { 'x-internal-key': env.internalKey }, signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', `Could not reach upstream service: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const status = res.status === 404 ? 404 : 502;
    throw new AppError(status, 'UPSTREAM_ERROR', body?.error?.message || `Upstream responded ${res.status}`);
  }
  return body?.data;
};
