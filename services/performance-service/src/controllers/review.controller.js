// Performance Review Service. Model: Review. HR/Admin write reviews, employees read their own.
// req.user = { id, role, email } is filled from the gateway headers.
import Review from '../models/Review.js';
import { isStaff } from '../common/roles.js';
import { ok, created } from '../common/response.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';

const RATING_KEYS = ['quality', 'productivity', 'teamwork', 'communication'];

// Validates a ratings object. With `partial`, only the keys that are present are checked (for updates).
const parseRatings = (ratings, { partial = false } = {}) => {
  if (typeof ratings !== 'object' || ratings === null || Array.isArray(ratings)) {
    throw badRequest(`ratings must be an object with: ${RATING_KEYS.join(', ')}`);
  }
  const unknown = Object.keys(ratings).filter((k) => !RATING_KEYS.includes(k));
  if (unknown.length) throw badRequest(`Unknown rating field(s): ${unknown.join(', ')}`);

  const out = {};
  for (const key of RATING_KEYS) {
    if (ratings[key] === undefined) {
      if (!partial) throw badRequest(`ratings.${key} is required`);
      continue;
    }
    const value = ratings[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) {
      throw badRequest(`ratings.${key} must be a number between 1 and 5`);
    }
    out[key] = value;
  }
  return out;
};

const overall = (ratings) => {
  const sum = RATING_KEYS.reduce((acc, k) => acc + ratings[k], 0);
  return Math.round((sum / RATING_KEYS.length) * 10) / 10; // one decimal
};

const parseGoals = (goals) => {
  if (!Array.isArray(goals) || goals.some((g) => typeof g !== 'string')) {
    throw badRequest('goals must be an array of strings');
  }
  return goals.map((g) => g.trim()).filter(Boolean);
};

const parseText = (value, field) => {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  return value.trim();
};

// POST /api/reviews  (HR, Admin)
export const createReview = async (req, res) => {
  const { userId, period, ratings, feedback, goals } = req.body;

  if (typeof userId !== 'string' || !userId.trim()) throw badRequest('userId must be a non-empty string');
  if (typeof period !== 'string' || !period.trim()) throw badRequest('period must be a non-empty string');

  const cleanRatings = parseRatings(ratings);
  const data = {
    userId: userId.trim(),
    reviewerId: req.user.id,
    period: period.trim(),
    ratings: cleanRatings,
    overallRating: overall(cleanRatings),
  };
  if (feedback !== undefined) data.feedback = parseText(feedback, 'feedback');
  if (goals !== undefined) data.goals = parseGoals(goals);

  if (await Review.exists({ userId: data.userId, period: data.period })) {
    throw conflict('A review already exists for this employee and period');
  }

  const review = await Review.create(data); // the unique (userId, period) index also guards against races

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'REVIEW_CREATED',
    resource: 'review', resourceId: review.id, method: req.method, path: req.originalUrl,
    statusCode: 201, outcome: 'success', details: { employeeId: review.userId, period: review.period },
  });
  return created(res, review, 'Review created');
};

// GET /api/reviews  (HR, Admin)  -> filters ?userId= ?period=
export const listReviews = async (req, res) => {
  const { userId, period } = req.query;
  const filter = {};
  if (userId !== undefined) {
    if (typeof userId !== 'string' || !userId.trim()) throw badRequest('userId must be a string');
    filter.userId = userId.trim();
  }
  if (period !== undefined) {
    if (typeof period !== 'string' || !period.trim()) throw badRequest('period must be a string');
    filter.period = period.trim();
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/reviews/me  (any logged-in user)
export const myReviews = async (req, res) => {
  const filter = { userId: req.user.id };
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/reviews/:id  (owner of the review, or HR/Admin)
export const getReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw notFound('Review not found');
  if (!isStaff(req.user) && review.userId !== req.user.id) throw forbidden('You can only view your own reviews');
  return ok(res, review);
};

// PUT /api/reviews/:id  (HR, Admin)  -> ratings / feedback / goals
export const updateReview = async (req, res) => {
  const { ratings, feedback, goals } = req.body ?? {};
  if (ratings === undefined && feedback === undefined && goals === undefined) {
    throw badRequest('Provide at least one of: ratings, feedback, goals');
  }

  const review = await Review.findById(req.params.id);
  if (!review) throw notFound('Review not found');

  const changed = [];
  if (ratings !== undefined) {
    const merged = { ...review.ratings.toObject(), ...parseRatings(ratings, { partial: true }) };
    review.ratings = merged;
    review.overallRating = overall(merged);
    changed.push('ratings');
  }
  if (feedback !== undefined) {
    review.feedback = parseText(feedback, 'feedback');
    changed.push('feedback');
  }
  if (goals !== undefined) {
    review.goals = parseGoals(goals);
    changed.push('goals');
  }
  // userId, reviewerId and period are never read from the body, so they cannot change.

  await review.save();

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'REVIEW_UPDATED',
    resource: 'review', resourceId: review.id, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success', details: { employeeId: review.userId, fields: changed },
  });
  return ok(res, review, 'Review updated');
};

// DELETE /api/reviews/:id  (Admin only)  -> hard delete
export const deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw notFound('Review not found');

  sendAudit({
    actorId: req.user.id, actorRole: req.user.role, action: 'REVIEW_DELETED',
    resource: 'review', resourceId: review.id, method: req.method, path: req.originalUrl,
    statusCode: 200, outcome: 'success', details: { employeeId: review.userId, period: review.period },
  });
  return ok(res, { id: review.id }, 'Review deleted');
};
