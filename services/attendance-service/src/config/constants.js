// Business rules for time tracking - change here, not inside controllers.
export const STANDARD_WORK_HOURS = 8; // hours beyond this per day count as overtime
export const LATE_AFTER_HOUR = 9; // clock-in after 09:00 (server time) => status "late"

export const WORK_TIMEZONE = 'Asia/Phnom_Penh'; // used to decide "today" and the late cutoff

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD -> { date: { $gte, $lte } } (the `date` field is a plain string, so it compares correctly)
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