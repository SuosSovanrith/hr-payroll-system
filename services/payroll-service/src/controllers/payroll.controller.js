// Payroll Service. Models: SalaryStructure, Payslip. Maths: config/payrollRules.js (calculatePayslip).
// Inter-service calls use internalGet (common/internalClient.js) with URLs from `env`.
// req.user = { id, role, email } is filled from the gateway headers.
import SalaryStructure from '../models/SalaryStructure.js';
import Payslip from '../models/Payslip.js';
import { env } from '../config/env.js';
import { calculatePayslip } from '../config/payrollRules.js';
import { isStaff } from '../common/roles.js';
import { ok, created } from '../common/response.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';
import { internalGet } from '../common/internalClient.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

const assertMonth = (month) => {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) throw badRequest('month must be YYYY-MM');
};

// PUT /api/payroll/salary/:userId  (HR, Admin)   Body: { baseSalary, currency? }
export const setSalary = async (req, res) => {
  const { userId } = req.params;
  const { baseSalary, currency } = req.body;

  if (typeof baseSalary !== 'number' || !Number.isFinite(baseSalary) || baseSalary < 0) {
    throw badRequest('baseSalary must be a number greater than or equal to 0');
  }
  if (currency !== undefined && (typeof currency !== 'string' || !CURRENCY_RE.test(currency))) {
    throw badRequest('currency must be a 3-letter code such as USD');
  }

  const update = { baseSalary, updatedBy: req.user.id };
  if (currency !== undefined) update.currency = currency.toUpperCase();

  const salary = await SalaryStructure.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'SALARY_UPDATED',
    resource: 'salary', resourceId: userId, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success', details: { baseSalary: salary.baseSalary, currency: salary.currency },
  });
  return ok(res, salary, 'Salary saved');
};

// GET /api/payroll/salary/:userId  (HR/Admin: anyone, Employee: ONLY themselves)
export const getSalary = async (req, res) => {
  const { userId } = req.params;
  if (!isStaff(req.user) && req.user.id !== userId) throw forbidden('You can only view your own salary');

  const salary = await SalaryStructure.findOne({ userId });
  if (!salary) throw notFound('No salary configured for this employee');
  return ok(res, salary);
};

// POST /api/payroll/generate  (HR, Admin)   Body: { userId, month: "YYYY-MM" }
export const generatePayslip = async (req, res) => {
  const { userId, month } = req.body;
  if (typeof userId !== 'string' || !userId.trim()) throw badRequest('userId must be a non-empty string');
  assertMonth(month);
  const id = userId.trim();

  const salary = await SalaryStructure.findOne({ userId: id });
  if (!salary) throw notFound('No salary configured for this employee. Set a salary first');

  if (await Payslip.exists({ userId: id, month })) {
    throw conflict('A payslip has already been generated for this employee and month');
  }

  // Both calls throw 404 / 502 themselves when the profile is missing or a service is down.
  const [employee, attendance] = await Promise.all([
    internalGet(`${env.employeeServiceUrl}/internal/employees/${encodeURIComponent(id)}`),
    internalGet(`${env.attendanceServiceUrl}/internal/attendance/summary/${encodeURIComponent(id)}?month=${month}`),
  ]);

  const result = calculatePayslip({
    baseSalary: salary.baseSalary,
    overtimeHours: attendance?.overtimeHours ?? 0,
  });

  // The unique (userId, month) index turns a concurrent duplicate into a 409 as well.
  const payslip = await Payslip.create({
    userId: id,
    month,
    employee: {
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      department: employee.department,
      jobTitle: employee.jobTitle,
    },
    ...result,
    currency: salary.currency,
    generatedBy: req.user.id,
  });

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'PAYSLIP_GENERATED',
    resource: 'payslip', resourceId: payslip.id, method: req.method, path: req.originalUrl,
    statusCode: 201, outcome: 'success', details: { employeeId: id, month, net: payslip.net },
  });
  return created(res, payslip, 'Payslip generated');
};

// GET /api/payroll/payslips/me  (any logged-in user)  -> own payslips, newest month first, optional ?month=
export const myPayslips = async (req, res) => {
  const filter = { userId: req.user.id };
  if (req.query.month !== undefined) {
    assertMonth(req.query.month);
    filter.month = req.query.month;
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Payslip.find(filter).sort({ month: -1 }).skip(skip).limit(limit),
    Payslip.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/payroll/payslips  (HR, Admin)  -> filters ?month= ?userId=
export const listPayslips = async (req, res) => {
  const { month, userId } = req.query;
  const filter = {};
  if (month !== undefined) {
    assertMonth(month);
    filter.month = month;
  }
  if (userId !== undefined) {
    if (typeof userId !== 'string' || !userId.trim()) throw badRequest('userId must be a string');
    filter.userId = userId.trim();
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Payslip.find(filter).sort({ month: -1, userId: 1 }).skip(skip).limit(limit),
    Payslip.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/payroll/payslips/:id  (owner, or HR/Admin)
export const getPayslip = async (req, res) => {
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw notFound('Payslip not found');
  if (!isStaff(req.user) && payslip.userId !== req.user.id) throw forbidden('You can only view your own payslips');
  return ok(res, payslip);
};
