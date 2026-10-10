import { Router } from 'express';
import { requireAuth, requireRole } from '../common/requireRole.js';
import { requireFields } from '../common/validate.js';
import { ROLES, STAFF } from '../common/roles.js';
import { createReview, listReviews, myReviews, getReview, updateReview, deleteReview } from '../controllers/review.controller.js';

const router = Router();

// Mounted at /api/reviews. Keep '/me' BEFORE '/:id'.
router.post('/', requireRole(...STAFF), requireFields('userId', 'period', 'ratings'), createReview);
router.get('/', requireRole(...STAFF), listReviews);
router.get('/me', requireAuth, myReviews);
router.get('/:id', requireAuth, getReview);
router.put('/:id', requireRole(...STAFF), updateReview);
router.delete('/:id', requireRole(ROLES.ADMIN), deleteReview);

export default router;
