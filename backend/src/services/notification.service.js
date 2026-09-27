const { Notification, NotificationPreference } = require('../models');
const { sendMail } = require('./email.service');
const { sendSms } = require('./sms.service');
async function notify({ user, type, title, message, relatedJob, relatedApplication, channels = ['website'] }) {
  const preferences = user ? await NotificationPreference.findOne({ user: user._id }) : null;
  const allowed = channels.filter(channel => channel === 'website' ? preferences?.website !== false : preferences?.[channel] === true);
  if (user && allowed.includes('website')) await Notification.create({ user: user._id, type, title, message, relatedJob, relatedApplication });
  if (user && allowed.includes('email') && user.email && user.isEmailVerified) { try { await sendMail({ to: user.email, subject: title, text: message }); } catch (error) { console.error({ event: 'email_delivery_failure', errorType: error.name || 'Error', code: error.code || 'EMAIL_ERROR' }); } }
  if (user && allowed.includes('sms') && user.phoneNumber && user.isPhoneVerified) { try { await sendSms(user.phoneNumber, message); } catch (error) { console.error({ event: 'sms_delivery_failure', errorType: error.name || 'Error', code: error.code || 'SMS_ERROR' }); } }
}
module.exports = { notify };
