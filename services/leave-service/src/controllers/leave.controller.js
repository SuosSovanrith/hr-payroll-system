// Leave Management Service. Models: LeaveRequest, LeaveBalance (both in ./models).
import { notImplemented } from '../common/errors.js';

// TODO [Member 2] POST /api/leaves  (any logged-in user)   Body: { type, startDate, endDate, reason }
//  1. type must be in LEAVE_TYPES; endDate >= startDate; otherwise 400.
//  2. days = inclusive number of days between the dates.
//  3. Reject if it overlaps another pending/approved request of the same user -> 409.
//  4. For annual/sick: load (or lazily create) the user's LeaveBalance for the start year;
//     if (allocated - used) < days -> 400 "insufficient leave balance". Unpaid leave skips this check.
//  5. Create with status 'pending' (balance is only deducted on approval). Respond 201.
export const requestLeave = async (req, res) => {
  throw notImplemented('POST /api/leaves');
};

// TODO [Member 2] GET /api/leaves/me  (any logged-in user)  -> own requests, newest first, optional ?status=
export const myLeaves = async (req, res) => {
  throw notImplemented('GET /api/leaves/me');
};

// TODO [Member 2] GET /api/leaves  (HR, Admin)  -> all requests
//  Filters: ?status=, ?userId=. Paginate with getPagination -> { items, page, limit, total }.
export const listLeaves = async (req, res) => {
  throw notImplemented('GET /api/leaves');
};

// TODO [Member 2] PATCH /api/leaves/:id/review  (HR, Admin)   Body: { decision: 'approved' | 'rejected', comment }
//  1. decision must be one of the two values -> else 400. Request not found -> 404.
//  2. Only 'pending' requests can be reviewed -> else 409.
//  3. Nobody may review their OWN request (request.userId === req.user.id) -> 403.
//  4. On 'approved' for annual/sick: balance[type].used += days (use $inc so it is atomic).
//  5. Save status, reviewedBy = req.user.id, reviewComment; sendAudit({ action: 'LEAVE_APPROVED' | 'LEAVE_REJECTED', ... }).
export const reviewLeave = async (req, res) => {
  throw notImplemented('PATCH /api/leaves/:id/review');
};

// TODO [Member 2] DELETE /api/leaves/:id  (owner only)  -> cancel
//  1. Not found -> 404; request.userId !== req.user.id -> 403; status !== 'pending' -> 409.
//  2. Set status = 'cancelled' (keep the record) and respond ok.
export const cancelLeave = async (req, res) => {
  throw notImplemented('DELETE /api/leaves/:id');
};

// TODO [Member 2] GET /api/leaves/balance/me  (any logged-in user)
//  1. findOneAndUpdate({ userId, year }, { $setOnInsert: { userId, year } }, { upsert: true, new: true })
//     creates the balance with the schema defaults the first time.
//  2. Respond { year, annual: { allocated, used, remaining }, sick: { allocated, used, remaining } }.
export const myBalance = async (req, res) => {
  throw notImplemented('GET /api/leaves/balance/me');
};
