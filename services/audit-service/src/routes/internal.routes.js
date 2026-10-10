import { Router } from 'express';
import { createLog } from '../controllers/internal.controller.js';

const router = Router();

// Mounted at /internal/logs (protected by internalAuth in app.js, not reachable through the gateway)
router.post('/', createLog);

export default router;
