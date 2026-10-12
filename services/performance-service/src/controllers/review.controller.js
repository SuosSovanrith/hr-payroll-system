// Performance Review Service. Model: Review. HR/Admin write reviews, employees read their own.
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { ok, created } from '../common/response.js';
import { getPagination } from '../common/pagination.js';
import { sendAudit } from '../common/audit.js';
import { isStaff } from '../common/roles.js';
import Review from '../models/Review.js';

const RATING_FIELDS = ['quality', 'productivity', 'teamwork', 'communication'];

// Checks the four ratings are numbers from 1 to 5 and returns a clean { quality, ... } object (extra keys dropped).
// Done here so a bad value gives a clear 400 instead of a NaN average or a Mongoose cast error.
const parseRatings = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('ratings must be an object');
  const ratings = {};
  const details = [];
  for (const field of RATING_FIELDS) {
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) {
      details.push({ field: `ratings.${field}`, message: 'must be a number between 1 and 5' });
    } else {
      ratings[field] = value;
    }
  }
  if (details.length) throw badRequest('Invalid ratings', details);
  return ratings;
};

// Average of the 4 ratings, rounded to 1 decimal.
const overallOf = (ratings) =>
  Math.round((RATING_FIELDS.reduce((sum, f) => sum + ratings[f], 0) / RATING_FIELDS.length) * 10) / 10;

const parseText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`Invalid ${field}`, [{ field, message: 'must be a non-empty string' }]);
  }
  return value.trim();
};

const parseFeedback = (value) => {
  if (typeof value !== 'string') throw badRequest('Invalid feedback', [{ field: 'feedback', message: 'must be a string' }]);
  return value;
};

const parseGoals = (value) => {
  if (!Array.isArray(value) || !value.every((g) => typeof g === 'string')) {
    throw badRequest('Invalid goals', [{ field: 'goals', message: 'must be an array of strings' }]);
  }
  return value;
};

// POST /api/reviews  (HR, Admin)
// Body: { userId, period, ratings: { quality, productivity, teamwork, communication }, feedback, goals[] }
export const createReview = async (req, res) => {
  const { userId, period, ratings, feedback, goals } = req.body; // whitelist: nothing else from the body is used

  const cleanUserId = parseText(userId, 'userId'); // must be plain strings, never query operators
  const cleanPeriod = parseText(period, 'period');
  const cleanRatings = parseRatings(ratings);
  const cleanFeedback = feedback === undefined ? undefined : parseFeedback(feedback);
  const cleanGoals = goals === undefined ? [] : parseGoals(goals);

  const existing = await Review.findOne({ userId: cleanUserId, period: cleanPeriod });
  if (existing) throw conflict(`A review for this user and period (${cleanPeriod}) already exists`);

  const review = await Review.create({
    userId: cleanUserId,
    reviewerId: req.user.id, // from the gateway headers, never from the body
    period: cleanPeriod,
    ratings: cleanRatings,
    overallRating: overallOf(cleanRatings),
    feedback: cleanFeedback,
    goals: cleanGoals,
  });

  sendAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'REVIEW_CREATED',
    resource: 'review',
    resourceId: String(review._id),
    method: req.method,
    path: req.originalUrl,
    statusCode: 201,
    outcome: 'success',
    details: { userId: review.userId, period: review.period, overallRating: review.overallRating },
  });

  return created(res, review);
};

// GET /api/reviews  (HR, Admin)  -> filters ?userId= ?period=, paginated -> { items, page, limit, total }
export const listReviews = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.userId) filter.userId = String(req.query.userId);
  if (req.query.period) filter.period = String(req.query.period);

  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  return ok(res, { items, page, limit, total });
};

// GET /api/reviews/me  (any logged-in user)  -> own reviews, newest first
export const myReviews = async (req, res) => {
  const reviews = await Review.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return ok(res, reviews);
};

// GET /api/reviews/:id  (owner of the review, or HR/Admin)
export const getReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw notFound('Review not found');
  if (!isStaff(req.user) && review.userId !== req.user.id) throw forbidden('You can only view your own reviews');
  return ok(res, review);
};

// PUT /api/reviews/:id  (HR, Admin)  -> update ratings / feedback / goals
// userId, reviewerId and period can never be changed. Partial ratings are merged with the stored ones.
export const updateReview = async (req, res) => {
  const { ratings, feedback, goals } = req.body;

  const review = await Review.findById(req.params.id).lean();
  if (!review) throw notFound('Review not found');

  const update = {};
  if (ratings !== undefined) {
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) throw badRequest('ratings must be an object');
    update.ratings = parseRatings({ ...review.ratings, ...ratings });
    update.overallRating = overallOf(update.ratings); // recomputed because ratings changed
  }
  if (feedback !== undefined) update.feedback = parseFeedback(feedback);
  if (goals !== undefined) update.goals = parseGoals(goals);
  if (Object.keys(update).length === 0) {
    throw badRequest('Nothing to update: send ratings, feedback and/or goals');
  }

  const updated = await Review.findByIdAndUpdate(review._id, update, { new: true, runValidators: true });
  if (!updated) throw notFound('Review not found');
  return ok(res, updated, 'Review updated');
};

// DELETE /api/reviews/:id  (Admin only)  -> hard delete
export const deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw notFound('Review not found');

  sendAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'REVIEW_DELETED',
    resource: 'review',
    resourceId: String(review._id),
    method: req.method,
    path: req.originalUrl,
    statusCode: 200,
    outcome: 'success',
    details: { userId: review.userId, period: review.period },
  });

  return ok(res, { id: String(review._id) }, 'Review deleted');
};