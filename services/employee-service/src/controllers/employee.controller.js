// Employee Profile Service - CRUD for employee profiles.
// Helpers you will probably use: ok/created (common/response.js), badRequest/forbidden/notFound/conflict (common/errors.js),
// getPagination (common/pagination.js), isStaff (common/roles.js), sendAudit (common/audit.js).
// req.user = { id, role, email } is filled from the gateway headers.
import { notImplemented } from '../common/errors.js';

// TODO [Member 1] POST /api/employees  (HR, Admin)  -> create a profile for an existing user account
//  1. Required body: userId, firstName, lastName, email, department, jobTitle (route already checks presence).
//  2. If a profile with this userId already exists -> 409 (use conflict()).
//  3. Employee.create(req.body) (only pick allowed fields, do not trust arbitrary body keys) -> created(res, employee).
//  4. sendAudit({ action: 'EMPLOYEE_CREATED', resource: 'employee', resourceId: employee.userId, actorId: req.user.id, ... }).
export const createEmployee = async (req, res) => {
  throw notImplemented('POST /api/employees');
};

// TODO [Member 1] GET /api/employees  (HR, Admin)  -> list profiles
//  1. Filters: ?department=, ?status=, ?search= (firstName / lastName / email, case-insensitive regex).
//  2. Pagination with getPagination(req.query); sort by lastName.
//  3. Respond ok(res, { items, page, limit, total }).
export const listEmployees = async (req, res) => {
  throw notImplemented('GET /api/employees');
};

// TODO [Member 1] GET /api/employees/me  (any logged-in user)  -> own profile
//  1. Employee.findOne({ userId: req.user.id }); not found -> 404 ("profile not created yet, ask HR").
export const getMyProfile = async (req, res) => {
  throw notImplemented('GET /api/employees/me');
};

// TODO [Member 1] GET /api/employees/:userId  (HR/Admin: anyone, Employee: ONLY themselves)
//  1. If !isStaff(req.user) && req.user.id !== req.params.userId -> 403 (use forbidden()).
//  2. Find by userId; not found -> 404.
export const getEmployee = async (req, res) => {
  throw notImplemented('GET /api/employees/:userId');
};

// TODO [Member 1] PUT /api/employees/:userId  (HR/Admin: all fields, Employee: own phone + address ONLY)
//  1. Employee updating someone else -> 403.
//  2. Employee: whitelist ['phone', 'address'] - silently ignore (or 403 on) any other field like department/jobTitle.
//  3. Staff: whitelist every editable field EXCEPT userId.
//  4. findOneAndUpdate({ userId }, update, { new: true, runValidators: true }); not found -> 404.
//  5. sendAudit({ action: 'EMPLOYEE_UPDATED', ... }).
export const updateEmployee = async (req, res) => {
  throw notImplemented('PUT /api/employees/:userId');
};

// TODO [Member 1] DELETE /api/employees/:userId  (Admin only)  -> SOFT delete
//  1. Set status = 'terminated' instead of removing the document (payroll history still needs it).
//  2. Not found -> 404. sendAudit({ action: 'EMPLOYEE_TERMINATED', ... }).
export const deleteEmployee = async (req, res) => {
  throw notImplemented('DELETE /api/employees/:userId');
};
