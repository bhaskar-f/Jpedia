const { env } = require('../config/env');
function notFound(req, res, next) { next(Object.assign(new Error('Route not found.'), { status: 404, code: 'NOT_FOUND' })); }
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'MulterError') { error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400; error.code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR'; error.message = error.code === 'FILE_TOO_LARGE' ? 'Upload exceeds the 15 MB limit.' : 'File upload was rejected.'; }
  const status = error.status || (error.name === 'ValidationError' || error.name === 'ZodError' || error.name === 'CastError' ? 400 : error.code === 11000 ? 409 : 500);
  const code = error.code === 11000 ? 'DUPLICATE_RESOURCE' : error.code && typeof error.code === 'string' ? error.code : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  const message = status === 500 && env.nodeEnv === 'production' ? 'An unexpected error occurred.' : error.message;
  if (status >= 500) console.error({ event: 'api_error', requestId: req.id, path: req.path, errorType: error.name || 'Error', code });
  res.status(status).json({ success: false, error: { code, message, ...(status < 500 && error.details ? { details: error.details } : {}) } });
}
module.exports = { notFound, errorHandler };
