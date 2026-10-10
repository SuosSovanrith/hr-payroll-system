// Performance Review Service. Model: Review. HR/Admin write reviews, employees read their own.
import { notImplemented } from '../common/errors.js';

// TODO [Member 2] POST /api/reviews  (HR, Admin)
//  Body: { userId, period, ratings: { quality, productivity, teamwork, communication }, feedback, goals[] }
//  1. overallRating = average of the 4 ratings, rounded to 1 decimal.
//  2. reviewerId = req.user.id. Duplicate (userId, period) -> 409.
//  3. Respond 201 with the review; sendAudit({ action: 'REVIEW_CREATED', ... }).
export const createReview = async (req, res) => {
  throw notImplemented('POST /api/reviews');
};

// TODO [Member 2] GET /api/reviews  (HR, Admin)  -> filters ?userId=, ?period=; paginate -> { items, page, limit, total }
export const listReviews = async (req, res) => {
  throw notImplemented('GET /api/reviews');
};

// TODO [Member 2] GET /api/reviews/me  (any logged-in user)  -> reviews where userId = req.user.id, newest first
export const myReviews = async (req, res) => {
  throw notImplemented('GET /api/reviews/me');
};

// TODO [Member 2] GET /api/reviews/:id  (owner of the review, or HR/Admin)
//  Not found -> 404. Employee reading someone else's review -> 403 (check review.userId vs req.user.id, use isStaff()).
export const getReview = async (req, res) => {
  throw notImplemented('GET /api/reviews/:id');
};

// TODO [Member 2] PUT /api/reviews/:id  (HR, Admin)  -> update ratings / feedback / goals
//  Recompute overallRating if ratings changed. Use { new: true, runValidators: true }. Not found -> 404.
//  Do not allow changing userId or reviewerId.
export const updateReview = async (req, res) => {
  throw notImplemented('PUT /api/reviews/:id');
};

// TODO [Member 2] DELETE /api/reviews/:id  (Admin only)  -> hard delete, 404 if missing, sendAudit({ action: 'REVIEW_DELETED' }).
export const deleteReview = async (req, res) => {
  throw notImplemented('DELETE /api/reviews/:id');
};
