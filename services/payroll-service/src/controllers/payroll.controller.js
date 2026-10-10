// Payroll Service. Models: SalaryStructure, Payslip. Maths: config/payrollRules.js (calculatePayslip is already done).
// Inter-service calls use internalGet (common/internalClient.js) with URLs from `env`:
//   const emp = await internalGet(`${env.employeeServiceUrl}/internal/employees/${userId}`);
//   const att = await internalGet(`${env.attendanceServiceUrl}/internal/attendance/summary/${userId}?month=${month}`);
import { notImplemented } from '../common/errors.js';
// import { calculatePayslip } from '../config/payrollRules.js';

// TODO [Member 3] PUT /api/payroll/salary/:userId  (HR, Admin)   Body: { baseSalary, currency? }
//  1. baseSalary must be a number >= 0 -> else 400.
//  2. Upsert SalaryStructure by userId (findOneAndUpdate ..., { upsert: true, new: true, runValidators: true }), updatedBy = req.user.id.
//  3. sendAudit({ action: 'SALARY_UPDATED', resourceId: userId, ... }). Respond ok(res, salary).
export const setSalary = async (req, res) => {
  throw notImplemented('PUT /api/payroll/salary/:userId');
};

// TODO [Member 3] GET /api/payroll/salary/:userId  (HR/Admin: anyone, Employee: ONLY themselves)
//  Employee asking for someone else -> 403. No salary configured -> 404.
export const getSalary = async (req, res) => {
  throw notImplemented('GET /api/payroll/salary/:userId');
};

// TODO [Member 3] POST /api/payroll/generate  (HR, Admin)   Body: { userId, month: "YYYY-MM" }
//  1. Validate month format -> 400. Load SalaryStructure for userId; missing -> 404 "set a salary first".
//  2. Payslip already exists for (userId, month) -> 409.
//  3. Call Employee Service (internalGet) for name/department/jobTitle -> employee snapshot.
//  4. Call Attendance Service (internalGet) for { overtimeHours } of that month.
//  5. const result = calculatePayslip({ baseSalary, overtimeHours });
//  6. Payslip.create({ userId, month, employee: {...}, ...result, currency, generatedBy: req.user.id }) -> 201.
//  7. sendAudit({ action: 'PAYSLIP_GENERATED', resourceId: payslip.id, ... }).
//  If a downstream service is down, internalGet throws 502 - let it propagate.
export const generatePayslip = async (req, res) => {
  throw notImplemented('POST /api/payroll/generate');
};

// TODO [Member 3] GET /api/payroll/payslips/me  (any logged-in user)  -> own payslips, newest month first, optional ?month=
export const myPayslips = async (req, res) => {
  throw notImplemented('GET /api/payroll/payslips/me');
};

// TODO [Member 3] GET /api/payroll/payslips  (HR, Admin)  -> filters ?month=, ?userId=; paginate -> { items, page, limit, total }
export const listPayslips = async (req, res) => {
  throw notImplemented('GET /api/payroll/payslips');
};

// TODO [Member 3] GET /api/payroll/payslips/:id  (owner, or HR/Admin)
//  Not found -> 404. Employee opening someone else's payslip -> 403 (compare payslip.userId with req.user.id, use isStaff()).
export const getPayslip = async (req, res) => {
  throw notImplemented('GET /api/payroll/payslips/:id');
};
