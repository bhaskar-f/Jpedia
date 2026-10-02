const { rateLimit } = require('express-rate-limit');
const { MongoRateLimitStore } = require('./mongo-rate-limit.store');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, store: new MongoRateLimitStore('auth'), standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } } });
const otpLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, store: new MongoRateLimitStore('otp'), standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'OTP_RATE_LIMITED', message: 'Too many OTP requests. Try later.' } } });
module.exports = { authLimiter, otpLimiter };
