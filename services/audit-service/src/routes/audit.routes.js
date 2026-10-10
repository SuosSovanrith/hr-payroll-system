import { Router } from 'express';
import { requireRole } from '../common/requireRole.js';
import { ROLES } from '../common/roles.js';
import { listLogs, getLog } from '../controllers/audit.controller.js';

const router = Router();

// Mounted at /api/audit - Admin only
router.get('/logs', requireRole(ROLES.ADMIN), listLogs);
router.get('/logs/:id', requireRole(ROLES.ADMIN), getLog);

export default router;
