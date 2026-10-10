import { Router } from 'express';
import { requireRole } from '../common/requireRole.js';
import { ROLES, STAFF } from '../common/roles.js';
import { listUsers, changeRole } from '../controllers/user.controller.js';

const router = Router();

// Mounted at /api/users
router.get('/', requireRole(...STAFF), listUsers);
router.patch('/:id/role', requireRole(ROLES.ADMIN), changeRole);

export default router;
