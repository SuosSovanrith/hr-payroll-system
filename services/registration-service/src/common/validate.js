// Tiny request validation helper (Mongoose schemas do the rest of the validation).
import { badRequest } from './errors.js';

/** requireFields('email', 'password') -> 400 listing every missing field. */
export const requireFields = (...fields) => (req, res, next) => {
  const missing = fields.filter((f) => req.body?.[f] === undefined || req.body[f] === '');
  if (missing.length) {
    throw badRequest('Missing required fields', missing.map((field) => ({ field, message: 'is required' })));
  }
  next();
};
