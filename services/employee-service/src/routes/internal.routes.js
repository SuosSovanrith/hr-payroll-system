import { Router } from 'express';
import { getEmployeeInternal } from '../controllers/internal.controller.js';

const router = Router();

// Mounted at /internal/employees (protected by internalAuth in app.js, not reachable through the gateway)
router.get('/:userId', getEmployeeInternal);

export default router;
