// Central error handling. Standard error envelope: { success: false, error: { code, message, details } }
import { AppError } from './errors.js';

export const notFoundHandler = (req, res) =>
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });

// Express recognises error handlers by their 4 arguments - keep `_next` even if unused.
export const errorHandler = (err, req, res, _next) => {
  const send = (status, code, message, details) =>
    res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });

  if (err instanceof AppError) return send(err.status, err.code, err.message, err.details);
  if (err.type === 'entity.parse.failed') return send(400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return send(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
  if (err.name === 'CastError') return send(400, 'INVALID_ID', `Invalid value for "${err.path}"`);
  if (err.code === 11000) return send(409, 'DUPLICATE', 'Duplicate value', err.keyValue);

  console.error(err);
  return send(500, 'INTERNAL_ERROR', 'Something went wrong');
};
