const { User, NotificationPreference } = require('../models');
const auth = require('../services/auth.service');
const sms = require('../services/sms.service');
const { AppError, success } = require('../utils/http');
const { setAccessCookie, setRefreshCookie, clearRefreshCookie } = require('../middleware/auth.middleware');
async function establish(user, res) { const tokens = await auth.issueSession(user); setAccessCookie(res, tokens.accessToken); setRefreshCookie(res, tokens.refreshToken); }
const register = async (req, res) => { const result = await auth.register(req.body);await NotificationPreference.findOneAndUpdate({user:result.user._id},{$setOnInsert:{user:result.user._id}},{upsert:true});success(res,{user:auth.safeUser(result.user),verificationEmailSent:result.verificationEmailSent},201); };
const login = async (req, res) => { const user = await auth.authenticate(req.body.email, req.body.password); await establish(user, res); success(res, { user: auth.safeUser(user) }); };
const logout = async (req, res) => { await auth.logout(req.user.id); res.clearCookie('jinfo_access', { path: '/' }); clearRefreshCookie(res); success(res, { loggedOut: true }); };
const refresh = async (req, res) => { const token = req.cookies.jinfo_refresh; if (!token) throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'Sign in again.'); const result = await auth.rotate(token); setAccessCookie(res, result.tokens.accessToken); setRefreshCookie(res, result.tokens.refreshToken); success(res, { user: auth.safeUser(result.user) }); };
const verifyEmail = async (req, res) => success(res, { user: auth.safeUser(await auth.verifyEmail(req.body.token)) });
const resendVerification = async(req,res)=>{const {configured}=require('../services/email.service');if(!configured())throw new AppError(503,'EMAIL_NOT_CONFIGURED','Email delivery is not configured. Set the existing EMAIL_* settings on the server.');try{await auth.resendVerification(req.body.email);}catch(error){if(error.code!=='EMAIL_DELIVERY_FAILED')throw error;console.error({event:'verification_email_failure',code:error.code});}success(res,{message:'If the account needs verification, instructions will be sent.'});};
const forgotPassword = async (req, res) => { await auth.forgotPassword(req.body.email); success(res, { message: 'If the account exists, reset instructions have been sent.' }); };
const resetPassword = async (req, res) => { await auth.resetPassword(req.body.token, req.body.password); success(res, { passwordReset: true }); };
const sendOtp = async (req, res) => { await sms.sendOtp(req.body.phoneNumber); success(res, { sent: true }); };
const verifyOtp = async (req, res) => {
  const valid = await sms.verifyOtp(req.body.phoneNumber, req.body.code); if (!valid) throw new AppError(400, 'INVALID_OTP', 'The code is invalid or expired.');
  if (req.user) { const claimed = await User.findOne({ phoneNumber: req.body.phoneNumber, _id: { $ne: req.user._id } }); if (claimed) throw new AppError(409, 'PHONE_IN_USE', 'This phone number is already linked to another account.'); req.user.phoneNumber = req.body.phoneNumber; req.user.isPhoneVerified = true; await req.user.save(); return success(res, { user: auth.safeUser(req.user), phoneLinked: true }); }
  let user = await User.findOne({ phoneNumber: req.body.phoneNumber });
  if (!user) user = await User.create({ name: req.body.name || 'j-info user', phoneNumber: req.body.phoneNumber, isPhoneVerified: true, role: 'USER' });
  user.isPhoneVerified = true; await user.save(); await NotificationPreference.updateOne({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true }); await establish(user, res); success(res, { user: auth.safeUser(user) });
};
const setPhonePassword = async (req,res) => { if (!req.user.isPhoneVerified || !req.user.phoneNumber) throw new AppError(403,'VERIFIED_PHONE_REQUIRED','Verify a phone number before setting phone login.'); req.user.passwordHash=await require('bcryptjs').hash(req.body.password,12); await req.user.save(); success(res,{updated:true}); };
const loginPhone = async (req, res) => { const user = await User.findOne({ phoneNumber: req.body.phoneNumber }).select('+passwordHash'); if (!user?.passwordHash || !await require('bcryptjs').compare(req.body.password, user.passwordHash)) throw new AppError(401, 'INVALID_CREDENTIALS', 'Phone number or password is incorrect.'); await establish(user, res); success(res, { user: auth.safeUser(user) }); };
module.exports = { register, login, logout, refresh, verifyEmail, resendVerification, forgotPassword, resetPassword, sendOtp, verifyOtp, loginPhone, setPhonePassword };
