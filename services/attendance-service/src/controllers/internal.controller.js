import { ok } from '../common/response.js';
import { buildSummary, assertMonth } from './attendance.controller.js';

// Service-to-service, used by Payroll. Same data as the public summary, no role checks
// (the internal key already proves the caller is a trusted service).
// Contract: { userId, month, daysPresent, totalHours, overtimeHours }
export const getSummaryInternal = async (req, res) => {
  const { month } = req.query;
  assertMonth(month);
  return ok(res, await buildSummary(req.params.userId, month));
};