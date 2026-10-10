// ROUTE TABLE - the single source of truth for what the gateway exposes and who may call it.
//   * A request that matches no rule gets 404 (so /internal/* can never be reached from outside).
//   * `public: true`  -> no token needed.
//   * `roles: [...]`  -> valid JWT AND one of these roles (else 401 / 403).
//   * `audit: false`  -> the gateway does not log this route (the service logs it itself).
// Fine-grained rules ("employees may only read THEIR OWN record") are enforced inside each service.
// ORDER MATTERS: put specific paths (/me) before parameterised ones (/:id).
//
// TODO [All members]: every time you add or rename an endpoint in your service, add/update its rule here.
import { ROLES, STAFF } from '../common/roles.js';

const ANY = [ROLES.EMPLOYEE, ROLES.HR, ROLES.ADMIN]; // any logged-in user
const ADMIN = [ROLES.ADMIN];

export const routeTable = [
  // ---- Registration Service ----
  { method: 'POST', path: '/api/auth/register', public: true, service: 'registration' },
  { method: 'POST', path: '/api/auth/register/staff', roles: ADMIN, service: 'registration' },
  { method: 'GET', path: '/api/users', roles: STAFF, service: 'registration' },
  { method: 'PATCH', path: '/api/users/:id/role', roles: ADMIN, service: 'registration' },

  // ---- Login Service (the service audits logins itself) ----
  { method: 'POST', path: '/api/auth/login', public: true, service: 'login', audit: false },
  { method: 'GET', path: '/api/auth/me', roles: ANY, service: 'login' },

  // ---- Employee Profile Service ----
  { method: 'POST', path: '/api/employees', roles: STAFF, service: 'employee' },
  { method: 'GET', path: '/api/employees', roles: STAFF, service: 'employee' },
  { method: 'GET', path: '/api/employees/me', roles: ANY, service: 'employee' },
  { method: 'GET', path: '/api/employees/:userId', roles: ANY, service: 'employee' }, // service: self or staff
  { method: 'PUT', path: '/api/employees/:userId', roles: ANY, service: 'employee' }, // service: limited fields for self
  { method: 'DELETE', path: '/api/employees/:userId', roles: ADMIN, service: 'employee' },

  // ---- Attendance Service ----
  { method: 'POST', path: '/api/attendance/clock-in', roles: ANY, service: 'attendance' },
  { method: 'POST', path: '/api/attendance/clock-out', roles: ANY, service: 'attendance' },
  { method: 'GET', path: '/api/attendance/me', roles: ANY, service: 'attendance' },
  { method: 'GET', path: '/api/attendance/summary/:userId', roles: ANY, service: 'attendance' }, // service: self or staff
  { method: 'GET', path: '/api/attendance', roles: STAFF, service: 'attendance' },

  // ---- Leave Service ----
  { method: 'POST', path: '/api/leaves', roles: ANY, service: 'leave' },
  { method: 'GET', path: '/api/leaves/me', roles: ANY, service: 'leave' },
  { method: 'GET', path: '/api/leaves/balance/me', roles: ANY, service: 'leave' },
  { method: 'GET', path: '/api/leaves', roles: STAFF, service: 'leave' },
  { method: 'PATCH', path: '/api/leaves/:id/review', roles: STAFF, service: 'leave' },
  { method: 'DELETE', path: '/api/leaves/:id', roles: ANY, service: 'leave' }, // service: owner + pending only

  // ---- Performance Review Service ----
  { method: 'POST', path: '/api/reviews', roles: STAFF, service: 'performance' },
  { method: 'GET', path: '/api/reviews', roles: STAFF, service: 'performance' },
  { method: 'GET', path: '/api/reviews/me', roles: ANY, service: 'performance' },
  { method: 'GET', path: '/api/reviews/:id', roles: ANY, service: 'performance' }, // service: owner or staff
  { method: 'PUT', path: '/api/reviews/:id', roles: STAFF, service: 'performance' },
  { method: 'DELETE', path: '/api/reviews/:id', roles: ADMIN, service: 'performance' },

  // ---- Payroll Service ----
  { method: 'PUT', path: '/api/payroll/salary/:userId', roles: STAFF, service: 'payroll' },
  { method: 'GET', path: '/api/payroll/salary/:userId', roles: ANY, service: 'payroll' }, // service: self or staff
  { method: 'POST', path: '/api/payroll/generate', roles: STAFF, service: 'payroll' },
  { method: 'GET', path: '/api/payroll/payslips/me', roles: ANY, service: 'payroll' },
  { method: 'GET', path: '/api/payroll/payslips', roles: STAFF, service: 'payroll' },
  { method: 'GET', path: '/api/payroll/payslips/:id', roles: ANY, service: 'payroll' }, // service: owner or staff

  // ---- Audit Service ----
  { method: 'GET', path: '/api/audit/logs', roles: ADMIN, service: 'audit' },
  { method: 'GET', path: '/api/audit/logs/:id', roles: ADMIN, service: 'audit' },
];

// Turn "/api/employees/:userId" into /^\/api\/employees\/[^/]+\/?$/ once at startup.
const compiled = routeTable.map((rule) => ({
  ...rule,
  regex: new RegExp(`^${rule.path.replace(/:[^/]+/g, '[^/]+')}/?$`),
}));

export const findRule = (method, path) =>
  compiled.find((rule) => rule.method === method && rule.regex.test(path));
