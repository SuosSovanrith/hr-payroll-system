import { Router } from 'express';
import { requireAuth, requireRole } from '../common/requireRole.js';
import { STAFF } from '../common/roles.js';
import { clockIn, clockOut, getMyAttendance, listAttendance, getSummary } from '../controllers/attendance.controller.js';

const router = Router();

// Mounted at /api/attendance
router.post('/clock-in', requireAuth, clockIn);
router.post('/clock-out', requireAuth, clockOut);
router.get('/me', requireAuth, getMyAttendance);
router.get('/summary/:userId', requireAuth, getSummary);
router.get('/', requireRole(...STAFF), listAttendance);

export default router;
