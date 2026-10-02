const { User, NotificationPreference, SavedJob, Application, CommunityMember, Notification } = require('../models');
const auth = require('../services/auth.service');
const { success, AppError } = require('../utils/http');
const { clearAccessCookie, clearRefreshCookie } = require('../middleware/auth.middleware');
const getMe = async (req, res) => success(res, { user: auth.safeUser(req.user) });
const updateMe = async (req, res) => {
  const { preferences, ...fields } = req.body;
  Object.assign(req.user, fields);
  if (preferences) {
    const old = req.user.preferences?.toObject?.() || req.user.preferences || {};
    const incomingLocation = preferences.location;
    const location = incomingLocation
      ? { state: incomingLocation.state, district: incomingLocation.state === old.location?.state ? (incomingLocation.district || undefined) : incomingLocation.district }
      : old.location || {};
    req.user.preferences = {
      education: { ...(old.education || {}), ...(preferences.education || {}) },
      location,
      jobCategories: preferences.jobCategories ?? old.jobCategories ?? [],
      preferredBoards: preferences.preferredBoards ?? old.preferredBoards ?? [],
    };
    if (preferences.jobCategories !== undefined) req.user.preferredJobCategories = preferences.jobCategories;
    if (preferences.preferredBoards !== undefined) req.user.preferredExams = preferences.preferredBoards;
    const education = req.user.preferences.education;
    const educationValues = [education.level, ...(education.degrees || []), ...(education.fields || [])].filter(Boolean);
    const hadStructuredEducation = Boolean(old.education?.level || old.education?.degrees?.length || old.education?.fields?.length);
    // Do not replace an unmapped legacy string during the first structured-profile save.
    if ((education.level || education.degrees?.length || education.fields?.length) && (!req.user.education || hadStructuredEducation)) req.user.education = educationValues.join(' · ').slice(0, 100);
    // Keep an existing free-text location alongside the first structured state/district selection.
    if (incomingLocation?.state && (!req.user.location || old.location?.state)) req.user.location = [location.state, location.district].filter(Boolean).join(', ').slice(0, 100);
  }
  await req.user.save();
  success(res, { user: auth.safeUser(req.user) });
};
const deleteMe = async (req, res) => { await Promise.all([SavedJob.deleteMany({ user: req.user._id }), Application.deleteMany({ user: req.user._id }), CommunityMember.deleteMany({ user: req.user._id }), Notification.deleteMany({ user: req.user._id })]); req.user.isActive = false; req.user.authTokenVersion = (req.user.authTokenVersion || 0) + 1; req.user.email = req.user.email ? `deleted-${req.user.id}@invalid.local` : undefined; req.user.phoneNumber = undefined; req.user.refreshTokenHash = undefined; await req.user.save(); clearAccessCookie(res); clearRefreshCookie(res); success(res, { deleted: true }); };
const preferences = async (req, res) => { const value = await NotificationPreference.findOneAndUpdate({ user: req.user._id }, { $set: req.body, $setOnInsert: { user: req.user._id } }, { upsert: true, new: true }); success(res, value); };
const changeEmail=async(req,res)=>{try{return success(res,{verificationEmailSent:await auth.requestEmailChange(req.user,req.body.email)});}catch(error){if(error.code==='EMAIL_IN_USE')throw new AppError(400,'EMAIL_CHANGE_UNAVAILABLE','Unable to start this email change. Check the address and try again.');throw error;}};
const changePassword=async(req,res)=>{await auth.changePassword(req.user._id,req.body.currentPassword,req.body.newPassword,req.body.confirmPassword);clearAccessCookie(res);clearRefreshCookie(res);success(res,{passwordChanged:true,sessionsInvalidated:true});};
const updatePreferences = async (req, res) => { const allowed = ['email','sms','website','jobMatches','deadlineReminders','announcements']; if (Object.keys(req.body).some(key => !allowed.includes(key) || typeof req.body[key] !== 'boolean')) throw new AppError(400, 'VALIDATION_ERROR', 'Preferences must contain supported boolean notification settings.'); success(res, await NotificationPreference.findOneAndUpdate({ user: req.user._id }, { $set: req.body, $setOnInsert: { user: req.user._id } }, { upsert: true, new: true })); };
module.exports = { getMe, updateMe, deleteMe, preferences, updatePreferences, changeEmail, changePassword };
