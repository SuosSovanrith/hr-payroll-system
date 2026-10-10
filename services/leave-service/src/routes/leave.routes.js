import { Router } from 'express';
import { requireAuth, requireRole } from '../common/requireRole.js';
import { requireFields } from '../common/validate.js';
import { STAFF } from '../common/roles.js';
import { requestLeave, myLeaves, listLeaves, reviewLeave, cancelLeave, myBalance } from '../controllers/leave.controller.js';

const router = Router();

// Mounted at /api/leaves. Fixed paths ('/me', '/balance/me') are declared before '/:id' routes.
router.post('/', requireAuth, requireFields('type', 'startDate', 'endDate'), requestLeave);
router.get('/me', requireAuth, myLeaves);
router.get('/balance/me', requireAuth, myBalance);
router.get('/', requireRole(...STAFF), listLeaves);
router.patch('/:id/review', requireRole(...STAFF), requireFields('decision'), reviewLeave);
router.delete('/:id', requireAuth, cancelLeave);

export default router;
