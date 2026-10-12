// Employee Profile Service - CRUD for employee profiles.

// req.user = { id, role, email } is filled from the gateway headers.

import Employee from '../models/Employee.js';
import { isStaff } from '../common/roles.js';
import { ok, created } from '../common/response.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';

// Only these keys are ever copied from a request body into the database.
const CREATE_FIELDS = [
  'userId', 
  'firstName', 
  'lastName', 
  'email', 
  'phone', 
  'address',
  'dateOfBirth', 
  'department', 
  'jobTitle', 
  'employmentType', 
  'hireDate',
];
const pick = (source, keys) =>
  Object.fromEntries(keys.filter((k) => source?.[k] !== undefined).map((k) => [k, source[k]]));

export const createEmployee = async (req, res) => {
  const data = pick(req.body, CREATE_FIELDS);

  if (typeof data.userId !== 'string') throw badRequest('userId must be a string');
  if (await Employee.exists({ userId: data.userId })) {
    throw conflict('An employee profile already exists for this userId');
  }

  const employee = await Employee.create(data);

  sendAudit({
    actorId: req.user.id, 
    actorRole: req.user.role, 
    action: 'EMPLOYEE_CREATED',
    resource: 'employee', 
    resourceId: employee.userId, 
    method: req.method, 
    path: req.originalUrl,
    statusCode: 201, 
    outcome: 'success',
  });
  return created(res, employee, 'Employee profile created');
};

// [DONE - Member 1] GET /api/employees  (HR, Admin)  -> list profiles
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listEmployees = async (req, res) => {
  const { department, status, search } = req.query;
  const filter = {};

  if (typeof department === 'string' && department.trim()) {
    filter.department = new RegExp(`^${escapeRegex(department.trim())}$`, 'i'); // exact, any case
  }
  if (status !== undefined) {
    if (!['active', 'terminated'].includes(status)) throw badRequest('status must be active or terminated');
    filter.status = status;
  }
  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Employee.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(filter),
  ]);

  return ok(res, { items, page, limit, total });
};


// [DONE - Member 1] GET /api/employees/me  (any logged-in user)  -> own profile
export const getMyProfile = async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user.id });
  if (!employee) throw notFound('Profile not created yet, ask HR');
  return ok(res, employee);
};

// [DONE - Member 1] GET /api/employees/:userId  (HR/Admin: anyone, Employee: ONLY themselves)
export const getEmployee = async (req, res) => {
  const { userId } = req.params;

  // Employees may only read their own profile. HR and Admin may read anyone's.
  if (!isStaff(req.user) && req.user.id !== userId) {
    throw forbidden('You can only view your own profile');
  }

  const employee = await Employee.findOne({ userId });
  if (!employee) throw notFound('Employee not found');
  return ok(res, employee);
};

// [DONE - Member 1] PUT /api/employees/:userId  (HR/Admin: all fields, Employee: own phone + address ONLY)
const STAFF_UPDATE_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth',
  'department', 'jobTitle', 'employmentType', 'hireDate', 'status',
];
const SELF_UPDATE_FIELDS = ['phone', 'address'];

export const updateEmployee = async (req, res) => {
  const { userId } = req.params;
  const staff = isStaff(req.user);

  if (!staff && req.user.id !== userId) throw forbidden('You can only update your own profile');

  let update;
  if (staff) {
    update = pick(req.body, STAFF_UPDATE_FIELDS); // userId is not in the list, so it can never change
  } else {
    const blocked = Object.keys(req.body ?? {}).filter((k) => !SELF_UPDATE_FIELDS.includes(k));
    if (blocked.length) {
      throw forbidden(`Employees can only update: ${SELF_UPDATE_FIELDS.join(', ')} (not: ${blocked.join(', ')})`);
    }
    update = pick(req.body, SELF_UPDATE_FIELDS);
  }
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const employee = await Employee.findOneAndUpdate(
    { userId }, { $set: update }, { new: true, runValidators: true },
  );
  if (!employee) throw notFound('Employee not found');

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'EMPLOYEE_UPDATED',
    resource: 'employee', resourceId: userId, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success', details: { fields: Object.keys(update) },
  });
  return ok(res, employee, 'Employee updated');
};

// [DONE - Member 1] DELETE /api/employees/:userId  (Admin only)  -> SOFT delete
export const deleteEmployee = async (req, res) => {
  const { userId } = req.params;

  // Soft delete: keep the document, because payroll history still needs it.
  const employee = await Employee.findOneAndUpdate(
    { userId }, { $set: { status: 'terminated' } }, { new: true },
  );
  if (!employee) throw notFound('Employee not found');

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'EMPLOYEE_TERMINATED',
    resource: 'employee', resourceId: userId, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success',
  });
  return ok(res, employee, 'Employee terminated');
};
