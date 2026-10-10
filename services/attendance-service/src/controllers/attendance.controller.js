// Attendance & Time-Tracking Service.
// Models: Attendance. Rules live in config/constants.js. Dates are stored as "YYYY-MM-DD" strings in `date`.
import { notImplemented } from '../common/errors.js';

// TODO [Member 1] POST /api/attendance/clock-in  (any logged-in user)
//  1. date = today's "YYYY-MM-DD"; if a record for (req.user.id, date) exists -> 409 "already clocked in today".
//  2. Create { userId: req.user.id, date, clockIn: new Date(), status: 'incomplete' }.
//  3. Respond 201 with the record.
export const clockIn = async (req, res) => {
  throw notImplemented('POST /api/attendance/clock-in');
};

// TODO [Member 1] POST /api/attendance/clock-out  (any logged-in user)   Body (optional): { workLog }
//  1. Find today's record; none -> 400 "clock in first"; already has clockOut -> 409.
//  2. clockOut = now; totalHours = (clockOut - clockIn) / 3600000, rounded to 2 decimals.
//  3. overtimeHours = max(0, totalHours - STANDARD_WORK_HOURS).
//  4. status = 'late' if clockIn hour >= LATE_AFTER_HOUR else 'present'. Save workLog. Respond with the record.
export const clockOut = async (req, res) => {
  throw notImplemented('POST /api/attendance/clock-out');
};

// TODO [Member 1] GET /api/attendance/me  (any logged-in user)
//  1. Filter by userId = req.user.id and optional ?from=YYYY-MM-DD&to=YYYY-MM-DD (compare on the `date` string).
//  2. Sort by date desc, paginate with getPagination, respond { items, page, limit, total }.
export const getMyAttendance = async (req, res) => {
  throw notImplemented('GET /api/attendance/me');
};

// TODO [Member 1] GET /api/attendance  (HR, Admin)  -> all records
//  1. Filters: ?userId=, ?from=, ?to=. Paginate. Sort by date desc.
export const listAttendance = async (req, res) => {
  throw notImplemented('GET /api/attendance');
};

// Shared helper for the two summary endpoints below.
// TODO [Member 1] Implement buildSummary(userId, month) where month = "YYYY-MM".
//  Use an aggregation (or find + reduce) over records whose `date` starts with the month.
//  Contract (Payroll depends on this exact shape):
//    { userId, month, daysPresent, totalHours, overtimeHours }   // numbers rounded to 2 decimals; zeros if no records
export const buildSummary = async (userId, month) => {
  throw notImplemented('buildSummary');
};

// TODO [Member 1] GET /api/attendance/summary/:userId?month=YYYY-MM  (HR/Admin: anyone, Employee: ONLY themselves)
//  1. Validate `month` with /^\d{4}-(0[1-9]|1[0-2])$/ -> else 400.
//  2. If !isStaff(req.user) && req.user.id !== req.params.userId -> 403.
//  3. Respond ok(res, await buildSummary(req.params.userId, month)).
export const getSummary = async (req, res) => {
  throw notImplemented('GET /api/attendance/summary/:userId');
};
