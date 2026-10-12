import Employee from '../models/Employee.js';
import { ok } from '../common/response.js';
import { notFound } from '../common/errors.js';

// Service-to-service contract (Payroll depends on it, do not rename fields):
// { userId, firstName, lastName, email, department, jobTitle }
export const getEmployeeInternal = async (req, res) => {
  const employee = await Employee.findOne({ userId: req.params.userId });
  if (!employee) throw notFound('Employee profile not found');

  const { userId, firstName, lastName, email, department, jobTitle } = employee;
  return ok(res, { userId, firstName, lastName, email, department, jobTitle });
};