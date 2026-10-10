import { Router } from 'express';
import { requireFields } from '../common/validate.js';
import { requireRole } from '../common/requireRole.js';
import { ROLES } from '../common/roles.js';
import { register, registerStaff } from '../controllers/auth.controller.js';

const router = Router();

// Mounted at /api/auth
router.post('/register', requireFields('email', 'password', 'fullName'), register);
router.post('/register/staff', requireRole(ROLES.ADMIN), requireFields('email', 'password', 'fullName', 'role'), registerStaff);

export default router;
