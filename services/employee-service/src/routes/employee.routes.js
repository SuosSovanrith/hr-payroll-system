import { Router } from 'express';
import { requireAuth, requireRole } from '../common/requireRole.js';
import { requireFields } from '../common/validate.js';
import { ROLES, STAFF } from '../common/roles.js';
import {
  createEmployee, listEmployees, getMyProfile, getEmployee, updateEmployee, deleteEmployee,
} from '../controllers/employee.controller.js';

const router = Router();

// Mounted at /api/employees. Keep '/me' BEFORE '/:userId'.
router.post('/', requireRole(...STAFF), requireFields('userId', 'firstName', 'lastName', 'email', 'department', 'jobTitle'), createEmployee);
router.get('/', requireRole(...STAFF), listEmployees);
router.get('/me', requireAuth, getMyProfile);
router.get('/:userId', requireAuth, getEmployee);
router.put('/:userId', requireAuth, updateEmployee);
router.delete('/:userId', requireRole(ROLES.ADMIN), deleteEmployee);

export default router;
