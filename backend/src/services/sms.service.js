const twilio = require('twilio');
const crypto = require('crypto');
const { env } = require('../config/env');
const {OtpThrottle}=require('../models');
function client() { if (!env.twilioSid || !env.twilioToken) throw Object.assign(new Error('SMS provider is not configured.'), { status: 503, code: 'SMS_NOT_CONFIGURED' }); return twilio(env.twilioSid, env.twilioToken); }
async function sendOtp(phoneNumber) {
  if (!env.twilioVerifySid) throw Object.assign(new Error('Twilio Verify is not configured.'), { status: 503, code: 'OTP_NOT_CONFIGURED' });
  const now=Date.now();const phoneHash=crypto.createHash('sha256').update(phoneNumber).digest('hex');let throttle=await OtpThrottle.findOne({phoneHash});
  if(throttle){if(now-new Date(throttle.lastRequestedAt||0).getTime()<60000)throw Object.assign(new Error('Wait 60 seconds before requesting another code.'),{status:429,code:'OTP_COOLDOWN'});if(now-new Date(throttle.windowStartedAt||0).getTime()<3600000&&throttle.requestCount>=5)throw Object.assign(new Error('OTP request limit reached. Try again later.'),{status:429,code:'OTP_RATE_LIMITED'});if(now-new Date(throttle.windowStartedAt||0).getTime()>=3600000){throttle.windowStartedAt=new Date(now);throttle.requestCount=0;}throttle.lastRequestedAt=new Date(now);throttle.requestCount++;throttle.expiresAt=new Date(now+86400000);await throttle.save();}
  else await OtpThrottle.create({phoneHash,lastRequestedAt:new Date(now),windowStartedAt:new Date(now),requestCount:1,expiresAt:new Date(now+86400000)});
  return client().verify.v2.services(env.twilioVerifySid).verifications.create({ to: phoneNumber, channel: 'sms' });
}
async function verifyOtp(phoneNumber, code) { if (!env.twilioVerifySid) throw Object.assign(new Error('Twilio Verify is not configured.'), { status: 503, code: 'OTP_NOT_CONFIGURED' }); const result = await client().verify.v2.services(env.twilioVerifySid).verificationChecks.create({ to: phoneNumber, code }); return result.status === 'approved'; }
async function sendSms(to, body) { if (!env.twilioFromNumber) throw Object.assign(new Error('Twilio messaging number is not configured.'), { status: 503, code: 'SMS_NOT_CONFIGURED' }); return client().messages.create({ to, from: env.twilioFromNumber, body }); }
module.exports = { sendOtp, verifyOtp, sendSms };
