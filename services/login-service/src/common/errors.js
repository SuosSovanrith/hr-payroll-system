// Error helpers. Throw these from controllers/middleware; errorHandler.js turns them into the standard JSON error.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'You do not have permission', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message = 'Resource already exists') => new AppError(409, 'CONFLICT', message);
// Used by every unfinished endpoint so the API clearly says "not done yet" instead of hanging.
export const notImplemented = (what = 'This endpoint') =>
  new AppError(501, 'NOT_IMPLEMENTED', `${what} is not implemented yet (see the TODO in its controller)`);
