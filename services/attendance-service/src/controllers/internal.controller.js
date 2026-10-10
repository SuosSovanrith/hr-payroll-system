import { notImplemented } from '../common/errors.js';
// import { buildSummary } from './attendance.controller.js';

// TODO [Member 1] GET /internal/attendance/summary/:userId?month=YYYY-MM  (service-to-service, used by Payroll)
//  Same data as the public summary but WITHOUT role checks (the internal key already proves the caller is a trusted service).
//  Validate `month`, then respond ok(res, await buildSummary(userId, month)).
export const getSummaryInternal = async (req, res) => {
  throw notImplemented('GET /internal/attendance/summary/:userId');
};
