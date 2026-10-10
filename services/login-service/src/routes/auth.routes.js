import { Router } from 'express';
import { requireFields } from '../common/validate.js';
import { requireAuth } from '../common/requireRole.js';
import { login, me } from '../controllers/auth.controller.js';

const router = Router();

// Mounted at /api/auth
router.post('/login', requireFields('email', 'password'), login);
router.get('/me', requireAuth, me);

export default router;
