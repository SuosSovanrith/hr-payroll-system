// Attendance & Time-Tracking Service.
// Models: Attendance. Rules live in config/constants.js. Dates are stored as "YYYY-MM-DD" strings in `date`.
import Attendance from '../models/Attendance.js';
import { isStaff } from '../common/roles.js';
import { ok, created } from '../common/response.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';
import { STANDARD_WORK_HOURS, LATE_AFTER_HOUR, MAX_SHIFT_HOURS, WORK_TIMEZONE } from '../config/constants.js';

const round2 = (n) => Math.round(n * 100) / 100;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD -> { date: { $gte, $lte } } (`date` is a plain string, so it compares correctly)
const dateRange = ({ from, to }) => {
  const range = {};
  if (from !== undefined) {
    if (typeof from !== 'string' || !DATE_RE.test(from)) throw badRequest('from must be YYYY-MM-DD');
    range.$gte = from;
  }
  if (to !== undefined) {
    if (typeof to !== 'string' || !DATE_RE.test(to)) throw badRequest('to must be YYYY-MM-DD');
    range.$lte = to;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) throw badRequest('from must not be after to');
  return Object.keys(range).length ? { date: range } : {};
};

const findPage = async (filter, query) => {
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1, userId: 1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);
  return { items, page, limit, total };
};

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

// Sets clockOut and derives totalHours / overtimeHours / status.
// Shared by clock-out and by HR corrections so both follow the same rules.
const closeShift = (record, clockOutAt) => {
  const totalHours = round2((clockOutAt - record.clockIn) / 3600000);
  record.clockOut = clockOutAt;
  record.totalHours = totalHours;
  record.overtimeHours = round2(Math.max(0, totalHours - STANDARD_WORK_HOURS));
  record.status = localHour(record.clockIn) >= LATE_AFTER_HOUR ? 'late' : 'present';
};

// [DONE - Member 1] POST /api/attendance/clock-out  (any logged-in user)   Body (optional): { workLog }
// Closes the user's latest OPEN shift (so a night shift 22:00 -> 06:00 works across midnight).
export const clockOut = async (req, res) => {
  const now = new Date();
  const { workLog } = req.body ?? {};
  if (workLog !== undefined && typeof workLog !== 'string') throw badRequest('workLog must be a string');

  const record = await Attendance.findOne({ userId: req.user.id, clockOut: null }).sort({ date: -1 });
  if (!record) {
    const closedToday = await Attendance.exists({ userId: req.user.id, date: todayString(now) });
    throw closedToday ? conflict('You have already clocked out today') : badRequest('You have not clocked in. Clock in first');
  }

  // Forgotten clock-out: refuse to invent 30+ hours of pay. HR fixes it with PUT /api/attendance/:id.
  const hoursOpen = (now - record.clockIn) / 3600000;
  if (hoursOpen > MAX_SHIFT_HOURS) {
    throw conflict(`Your shift on ${record.date} was never closed (open ${round2(hoursOpen)} h). Ask HR to correct it`);
  }

  closeShift(record, now);
  if (workLog) record.workLog = workLog.trim();

  await record.save();
  return ok(res, record, 'Clocked out');
};

// [NEW] PUT /api/attendance/:id  (HR, Admin)   Body: { clockIn?, clockOut?, workLog? }  (ISO date-times)
// Fixes a forgotten or wrong clock-in/out. Totals, overtime and status are recalculated.
const parseDateTime = (value, field) => {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid ISO date-time`);
  return d;
};

export const correctAttendance = async (req, res) => {
  const { clockIn, clockOut, workLog } = req.body ?? {};
  if (clockIn === undefined && clockOut === undefined && workLog === undefined) {
    throw badRequest('Provide at least one of: clockIn, clockOut, workLog');
  }
  if (workLog !== undefined && typeof workLog !== 'string') throw badRequest('workLog must be a string');

  const record = await Attendance.findById(req.params.id);
  if (!record) throw notFound('Attendance record not found');

  const before = { clockIn: record.clockIn, clockOut: record.clockOut, totalHours: record.totalHours };

  if (clockIn !== undefined) {
    record.clockIn = parseDateTime(clockIn, 'clockIn');
    record.date = todayString(record.clockIn); // a duplicate (userId, date) is rejected by the unique index (409)
  }
  if (clockOut !== undefined) record.clockOut = parseDateTime(clockOut, 'clockOut');
  if (workLog !== undefined) record.workLog = workLog.trim();

  if (record.clockOut) {
    const hours = (record.clockOut - record.clockIn) / 3600000;
    if (hours <= 0) throw badRequest('clockOut must be after clockIn');
    if (hours > MAX_SHIFT_HOURS) throw badRequest(`A shift cannot be longer than ${MAX_SHIFT_HOURS} hours`);
    closeShift(record, record.clockOut);
  }
  record.correctedBy = req.user.id;
  await record.save();

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'ATTENDANCE_CORRECTED',
    resource: 'attendance', resourceId: record.id, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success', details: { employeeId: record.userId, before, after: { clockIn: record.clockIn, clockOut: record.clockOut, totalHours: record.totalHours } },
  });
  return ok(res, record, 'Attendance corrected');
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
