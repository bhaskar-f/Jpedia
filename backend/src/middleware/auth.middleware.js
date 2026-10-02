const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { User } = require('../models');
const { AppError, asyncHandler } = require('../utils/http');
const accessCookieOptions = () => ({ httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/', maxAge: env.accessTtlMs });
const refreshCookieOptions = () => ({ httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/api/auth', maxAge: env.refreshDays * 86400000 });
function setAccessCookie(res, token) { res.cookie('jinfo_access', token, accessCookieOptions()); }
function setRefreshCookie(res, token) { res.cookie('jinfo_refresh', token, refreshCookieOptions()); }
function clearAccessCookie(res) { res.clearCookie('jinfo_access', { ...accessCookieOptions(), maxAge: undefined }); }
function clearRefreshCookie(res) { res.clearCookie('jinfo_refresh', { ...refreshCookieOptions(), maxAge: undefined }); }
const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.jinfo_access || req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try { const payload = jwt.verify(token, env.jwtSecret, { issuer: 'j-info' }); req.user = await User.findById(payload.sub).select('_id name email phoneNumber profilePicture dateOfBirth preferences role education preferredExams preferredJobCategories location isEmailVerified isPhoneVerified isActive authTokenVersion'); if (req.user && (!req.user.isActive || payload.ver !== (req.user.authTokenVersion || 0))) req.user = null; }
  catch { req.user = null; }
  next();
};
const requireAuth = asyncHandler(async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  if (!req.user) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  next();
});
module.exports = { optionalAuth, requireAuth, setAccessCookie, setRefreshCookie, clearAccessCookie, clearRefreshCookie };
