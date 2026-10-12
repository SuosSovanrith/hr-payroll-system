// Attendance & Time-Tracking Service.
// Models: Attendance. Rules live in config/constants.js. Dates are stored as "YYYY-MM-DD" strings in `date`.
import Attendance from '../models/Attendance.js';
import { isStaff } from '../common/roles.js';
import { ok, created } from '../common/response.js';
import { getPagination } from '../common/pagination.js';
import { STANDARD_WORK_HOURS, LATE_AFTER_HOUR, WORK_TIMEZONE } from '../config/constants.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Date parts as seen in WORK_TIMEZONE (not the server's UTC clock).
const clockFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORK_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
const localParts = (d) => Object.fromEntries(clockFormat.formatToParts(d).map((p) => [p.type, p.value]));
const todayString = (d = new Date()) => {
  const p = localParts(d);
  return `${p.year}-${p.month}-${p.day}`; // "YYYY-MM-DD"
};
const localHour = (d) => Number(localParts(d).hour);

// [DONE - Member 1] POST /api/attendance/clock-in  (any logged-in user)
export const clockIn = async (req, res) => {
  const now = new Date();
  const date = todayString(now);

  if (await Attendance.exists({ userId: req.user.id, date })) {
    throw conflict('You have already clocked in today');
  }

  const record = await Attendance.create({ userId: req.user.id, date, clockIn: now, status: 'incomplete' });
  return created(res, record, 'Clocked in');
};

// [DONE - Member 1] POST /api/attendance/clock-out  (any logged-in user)   Body (optional): { workLog }
export const clockOut = async (req, res) => {
  const now = new Date();
  const { workLog } = req.body ?? {};
  if (workLog !== undefined && typeof workLog !== 'string') throw badRequest('workLog must be a string');

  const record = await Attendance.findOne({ userId: req.user.id, date: todayString(now) });
  if (!record) throw badRequest('You have not clocked in today. Clock in first');
  if (record.clockOut) throw conflict('You have already clocked out today');

  const totalHours = round2((now - record.clockIn) / 3600000);
  record.clockOut = now;
  record.totalHours = totalHours;
  record.overtimeHours = round2(Math.max(0, totalHours - STANDARD_WORK_HOURS));
  record.status = localHour(record.clockIn) >= LATE_AFTER_HOUR ? 'late' : 'present';
  if (workLog) record.workLog = workLog.trim();

  await record.save();
  return ok(res, record, 'Clocked out');
};

// [DONE - Member 1] GET /api/attendance/me  (any logged-in user)
export const getMyAttendance = async (req, res) => {
  const filter = { userId: req.user.id, ...dateRange(req.query) };
  return ok(res, await findPage(filter, req.query));
};

// [DONE - Member 1] GET /api/attendance  (HR, Admin)  -> all records
export const listAttendance = async (req, res) => {
  const { userId } = req.query;
  if (userId !== undefined && typeof userId !== 'string') throw badRequest('userId must be a string');

  const filter = { ...(userId && { userId }), ...dateRange(req.query) };
  return ok(res, await findPage(filter, req.query));
};

// Shared helper for the two summary endpoints below.
// [DONE - Member 1] Implement buildSummary(userId, month) where month = "YYYY-MM".
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const assertMonth = (month) => {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) throw badRequest('month must be YYYY-MM');
};

// Contract (Payroll depends on this exact shape): { userId, month, daysPresent, totalHours, overtimeHours }
export const buildSummary = async (userId, month) => {
  const [row] = await Attendance.aggregate([
    {
      $match: {
        userId,
        date: { $gte: `${month}-01`, $lte: `${month}-31` }, // "YYYY-MM-DD" strings compare correctly as text
        status: { $in: ['present', 'late'] }, // only completed days; "incomplete" (no clock-out) is not counted
      },
    },
    {
      $group: {
        _id: null,
        daysPresent: { $sum: 1 },
        totalHours: { $sum: '$totalHours' },
        overtimeHours: { $sum: '$overtimeHours' },
      },
    },
  ]);

  return {
    userId,
    month,
    daysPresent: row?.daysPresent ?? 0,
    totalHours: round2(row?.totalHours ?? 0),
    overtimeHours: round2(row?.overtimeHours ?? 0),
  };
};

// [DONE - Member 1] GET /api/attendance/summary/:userId?month=YYYY-MM  (HR/Admin: anyone, Employee: ONLY themselves)
export const getSummary = async (req, res) => {
  const { userId } = req.params;
  assertMonth(req.query.month);

  if (!isStaff(req.user) && req.user.id !== userId) {
    throw forbidden('You can only view your own attendance summary');
  }
  return ok(res, await buildSummary(userId, req.query.month));
};
