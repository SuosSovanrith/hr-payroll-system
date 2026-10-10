import { notImplemented } from '../common/errors.js';

// TODO [Member 1] GET /internal/employees/:userId  (service-to-service, used by Payroll for payslip details)
//  Contract (do not change - Payroll depends on it): respond ok(res, { userId, firstName, lastName, email, department, jobTitle }).
//  Not found -> 404 (Payroll turns that into "employee profile missing").
export const getEmployeeInternal = async (req, res) => {
  throw notImplemented('GET /internal/employees/:userId');
};
