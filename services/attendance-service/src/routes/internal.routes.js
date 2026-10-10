import { Router } from 'express';
import { getSummaryInternal } from '../controllers/internal.controller.js';

const router = Router();

// Mounted at /internal/attendance (protected by internalAuth in app.js, not reachable through the gateway)
router.get('/summary/:userId', getSummaryInternal);

export default router;
