class AppError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const success = (res, data, status = 200, extra = {}) => res.status(status).json({ success: true, data, ...extra });
module.exports = { AppError, asyncHandler, success };
