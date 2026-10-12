// Payroll Service. Models: SalaryStructure, Payslip. Maths: config/payrollRules.js (calculatePayslip).
// Inter-service calls use internalGet (common/internalClient.js) with URLs from `env`.
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { ok, created } from '../common/response.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';
import { isStaff } from '../common/roles.js';
import { internalGet } from '../common/internalClient.js';
import { env } from '../config/env.js';
import { calculatePayslip } from '../config/payrollRules.js';
import SalaryStructure from '../models/SalaryStructure.js';
import Payslip from '../models/Payslip.js';

const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/; // same rule as the Payslip model

// "YYYY-MM" only; anything else (wrong format, array, object) is a clean 400.
const parseMonth = (value) => {
  if (typeof value !== 'string' || !MONTH_FORMAT.test(value)) {
    throw badRequest('Invalid month', [{ field: 'month', message: 'must be in YYYY-MM format, e.g. 2026-10' }]);
  }
  return value;
};

// Plain non-empty string only, so a body like {"$ne": null} can never reach a query.
const parseUserId = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Invalid userId', [{ field: 'userId', message: 'must be a non-empty string' }]);
  }
  return value.trim();
};

// PUT /api/payroll/salary/:userId  (HR, Admin)   Body: { baseSalary, currency? }
// Creates or replaces the user's salary structure (upsert).
export const setSalary = async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const { baseSalary, currency } = req.body; // whitelist: nothing else from the body is used

  if (typeof baseSalary !== 'number' || !Number.isFinite(baseSalary) || baseSalary < 0) {
    throw badRequest('Invalid baseSalary', [{ field: 'baseSalary', message: 'must be a number >= 0' }]);
  }

  const update = { baseSalary, updatedBy: req.user.id };
  if (currency !== undefined) {
    if (typeof currency !== 'string' || !currency.trim()) {
      throw badRequest('Invalid currency', [{ field: 'currency', message: 'must be a non-empty string, e.g. USD' }]);
    }
    update.currency = currency.trim().toUpperCase();
  }

  const salary = await SalaryStructure.findOneAndUpdate({ userId }, update, {
    upsert: true,
    new: true,
    runValidators: true,
  });

  sendAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'SALARY_UPDATED',
    resource: 'salary',
    resourceId: userId,
    method: req.method,
    path: req.originalUrl,
    statusCode: 200,
    outcome: 'success',
    details: { baseSalary: salary.baseSalary, currency: salary.currency },
  });

  return ok(res, salary, 'Salary saved');
};

// GET /api/payroll/salary/:userId  (HR/Admin: anyone, Employee: only themselves)
export const getSalary = async (req, res) => {
  const userId = parseUserId(req.params.userId);
  if (!isStaff(req.user) && userId !== req.user.id) throw forbidden('You can only view your own salary');

  const salary = await SalaryStructure.findOne({ userId });
  if (!salary) throw notFound('No salary configured for this user');
  return ok(res, salary);
};

// POST /api/payroll/generate  (HR, Admin)   Body: { userId, month: "YYYY-MM" }
// Needs a salary structure, then pulls the profile from Employee and the overtime from Attendance.
export const generatePayslip = async (req, res) => {
  const userId = parseUserId(req.body.userId);
  const month = parseMonth(req.body.month);

  const salary = await SalaryStructure.findOne({ userId });
  if (!salary) throw notFound('No salary structure for this user. Set a salary first (PUT /api/payroll/salary/:userId)');

  if (await Payslip.exists({ userId, month })) {
    throw conflict(`A payslip for this user and month (${month}) already exists`);
  }

  // If a downstream service is down or has no data, internalGet throws (502 / 404) and we let it propagate.
  const id = encodeURIComponent(userId);
  const employee = await internalGet(`${env.employeeServiceUrl}/internal/employees/${id}`);
  const attendance = await internalGet(`${env.attendanceServiceUrl}/internal/attendance/summary/${id}?month=${month}`);

  const overtimeHours = Math.max(0, Number(attendance?.overtimeHours) || 0);
  const result = calculatePayslip({ baseSalary: salary.baseSalary, overtimeHours });

  // The unique (userId, month) index is the backstop if two requests race: it becomes a 409 too.
  const payslip = await Payslip.create({
    userId,
    month,
    employee: {
      name: [employee?.firstName, employee?.lastName].filter(Boolean).join(' '),
      department: employee?.department,
      jobTitle: employee?.jobTitle,
    },
    ...result,
    currency: salary.currency,
    generatedBy: req.user.id, // from the gateway headers, never from the body
  });

  sendAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'PAYSLIP_GENERATED',
    resource: 'payslip',
    resourceId: String(payslip._id),
    method: req.method,
    path: req.originalUrl,
    statusCode: 201,
    outcome: 'success',
    details: { userId, month, gross: payslip.gross, net: payslip.net },
  });

  return created(res, payslip);
};

// GET /api/payroll/payslips/me  (any logged-in user)  -> own payslips, newest month first, optional ?month=
export const myPayslips = async (req, res) => {
  const filter = { userId: req.user.id };
  if (req.query.month !== undefined && req.query.month !== '') filter.month = parseMonth(req.query.month);

  const payslips = await Payslip.find(filter).sort({ month: -1, createdAt: -1 });
  return ok(res, payslips);
};

// GET /api/payroll/payslips  (HR, Admin)  -> filters ?month= ?userId=, paginated -> { items, page, limit, total }
export const listPayslips = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.month !== undefined && req.query.month !== '') filter.month = parseMonth(req.query.month);
  if (req.query.userId) filter.userId = String(req.query.userId);

  const [items, total] = await Promise.all([
    Payslip.find(filter).sort({ month: -1, createdAt: -1 }).skip(skip).limit(limit),
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