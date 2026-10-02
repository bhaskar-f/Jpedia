const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { env } = require('../config/env');
const { randomToken, hashToken } = require('../utils/tokens');
const { AppError } = require('../utils/http');
const { sendMail, configured: emailConfigured } = require('./email.service');
function safeUser(user) { const value = user.toObject ? user.toObject() : { ...user }; for(const field of ['passwordHash','refreshTokenHash','emailVerificationHash','emailVerificationExpires','passwordResetHash','passwordResetExpires','pendingEmail','googleId','authTokenVersion','isActive'])delete value[field]; if(!value.preferences){value.preferences={education:{},location:{},jobCategories:value.preferredJobCategories||[],preferredBoards:value.preferredExams||[]};const place=String(value.location||'').split(',').map(item=>item.trim());const locations=require('../data/india-locations.json');const state=locations.states.find(item=>item.name.toLowerCase()===place[0]?.toLowerCase());if(state)value.preferences.location={state:state.name,district:state.districts.find(item=>item.toLowerCase()===place[1]?.toLowerCase())};if(value.education)value.preferences.education.fields=[value.education];}return value; }
async function register(input) {
  if (await User.exists({ email: input.email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  const verify = randomToken(); const user = await User.create({ name: input.name, email: input.email, phoneNumber: input.phoneNumber, passwordHash: await bcrypt.hash(input.password, 12), role: 'USER', emailVerificationHash: hashToken(verify), emailVerificationExpires: new Date(Date.now() + 86400000) });
  const verifyUrl = `${env.clientOrigin}/#verifyEmail=${encodeURIComponent(verify)}`;
  let verificationEmailSent=false;try{verificationEmailSent=await sendMail({ to: user.email, subject: 'Verify your SetBGet account', text: `Verify your email using this link: ${verifyUrl}`, html: `<p>Welcome to SetBGet.</p><p><a href="${verifyUrl}">Verify your email address</a></p><p>This link expires in 24 hours.</p>` });}catch(error){console.error({event:'verification_email_failure',code:error.code||'EMAIL_ERROR'});}
  return { user, verificationEmailSent };
}
async function authenticate(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !await bcrypt.compare(password, user.passwordHash || '')) { console.warn({event:'authentication_failure',method:'email_password'});throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'); }
  if (user.email && !user.isEmailVerified) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
  return user;
}
async function issueSession(user) {
  const jti = crypto.randomUUID(); const refreshToken = jwt.sign({ sub: user.id, jti }, env.jwtRefreshSecret, { expiresIn: `${env.refreshDays}d`, issuer: 'j-info' });
  user.refreshTokenHash = hashToken(refreshToken); await user.save();
  const accessToken = jwt.sign({ sub: user.id, role: user.role, ver: user.authTokenVersion || 0 }, env.jwtSecret, { expiresIn: env.accessTtl, issuer: 'j-info' });
  return { accessToken, refreshToken };
}
async function rotate(refreshToken) {
  let payload; try { payload = jwt.verify(refreshToken, env.jwtRefreshSecret, { issuer: 'j-info' }); } catch { throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired. Sign in again.'); }
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive || !user.refreshTokenHash || hashToken(refreshToken) !== user.refreshTokenHash) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired. Sign in again.');
  return { user, tokens: await issueSession(user) };
}
async function logout(userId) { await User.findByIdAndUpdate(userId, { $inc: { authTokenVersion: 1 }, $unset: { refreshTokenHash: 1 } }); }
async function consumeToken(field, expiresField, token) {
  const hash = hashToken(token); const user = await User.findOneAndUpdate({ [field]: hash, [expiresField]: { $gt: new Date() } }, { $unset: { [field]: 1, [expiresField]: 1 } }, { new: true });
  if (!user) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'The token is invalid or expired.');
  return user;
}
async function verifyEmail(token) { const user = await consumeToken('emailVerificationHash', 'emailVerificationExpires', token); if(user.pendingEmail){if(await User.exists({email:user.pendingEmail,_id:{$ne:user._id}}))throw new AppError(409,'EMAIL_IN_USE','That email address is already in use.');user.email=user.pendingEmail;user.pendingEmail=undefined;}user.isEmailVerified = true; user.emailVerificationHash = undefined; user.emailVerificationExpires = undefined; await user.save(); return user; }
async function requestEmailChange(user,email){if(await User.exists({email,_id:{$ne:user._id}}))throw new AppError(409,'EMAIL_IN_USE','That email address is already in use.');const token=randomToken();user.pendingEmail=email;user.emailVerificationHash=hashToken(token);user.emailVerificationExpires=new Date(Date.now()+86400000);await user.save();const link=`${env.clientOrigin}/#verifyEmail=${encodeURIComponent(token)}`;return sendMail({to:email,subject:'Confirm your new SetBGet email',text:`Confirm your new email address: ${link}`,html:`<p><a href="${link}">Confirm your new email address</a></p><p>This link expires in 24 hours.</p>`});}
async function resendVerification(email) { const user=await User.findOne({email});if(!user||(user.isEmailVerified&&!user.pendingEmail))return false;const token=randomToken();const target=user.pendingEmail||user.email;user.emailVerificationHash=hashToken(token);user.emailVerificationExpires=new Date(Date.now()+86400000);await user.save();const link=`${env.clientOrigin}/#verifyEmail=${encodeURIComponent(token)}`;return sendMail({to:target,subject:user.pendingEmail?'Confirm your new SetBGet email':'Verify your SetBGet account',text:`Verify your email using this link: ${link}`,html:`<p><a href="${link}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`}); }
async function forgotPassword(email) {
  if (!emailConfigured()) throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured. Set the existing EMAIL_* settings on the server.');
  const user = await User.findOne({ email }); if (!user) return;
  const token = randomToken(); user.passwordResetHash = hashToken(token); user.passwordResetExpires = new Date(Date.now() + 3600000); await user.save();
  const link=`${env.clientOrigin}/#resetPassword=${encodeURIComponent(token)}`; try { await sendMail({ to: user.email, subject: 'Reset your SetBGet password', text: `Reset your password using this link: ${link}`, html: `<p>We received a request to reset your SetBGet password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in one hour. If you did not request it, ignore this email.</p>` }); } catch (error) { console.error({ event: 'password_reset_email_failure', code: error.code }); }
}
async function resetPassword(token, password) { const user = await consumeToken('passwordResetHash', 'passwordResetExpires', token); user.passwordHash = await bcrypt.hash(password, 12); user.passwordResetHash = undefined; user.passwordResetExpires = undefined; user.refreshTokenHash = undefined; user.authTokenVersion = (user.authTokenVersion || 0) + 1; await user.save(); }
async function changePassword(userId, currentPassword, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) throw new AppError(400, 'PASSWORD_CONFIRMATION_MISMATCH', 'The new passwords do not match.');
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  if (!user.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new AppError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.authTokenVersion = (user.authTokenVersion || 0) + 1;
  user.refreshTokenHash = undefined;
  await user.save();
}
async function authenticateGoogle(profile) {
  const email = profile.emails?.[0]?.value?.trim().toLowerCase();
  if (!email || !profile.id || profile.emails?.[0]?.verified !== true) throw new AppError(400, 'GOOGLE_EMAIL_MISSING', 'Google did not provide a verified email address.');
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.findOne({ email });
    if (user?.googleId && user.googleId !== profile.id) throw new AppError(409, 'GOOGLE_ACCOUNT_MISMATCH', 'This SetBGet account is already linked to a different Google account.');
  }
  if (!user) {
    user = await User.create({ name: profile.displayName || email, email, googleId: profile.id, profilePicture: profile.photos?.[0]?.value, isEmailVerified: true });
  } else {
    if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
    // A verified Google email may verify an existing matching account, but its
    // password, role, and existing profile fields are retained.
    if (!user.googleId) user.googleId = profile.id;
    if (!user.isEmailVerified) user.isEmailVerified = true;
    await user.save();
  }
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
  return user;
}
module.exports = { safeUser, register, authenticate, issueSession, rotate, logout, verifyEmail, requestEmailChange, resendVerification, forgotPassword, resetPassword, changePassword, authenticateGoogle };
