const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const { AppError } = require('../utils/http');
let transporter;
function configured() { return Boolean(env.emailHost && env.emailPort && env.emailUser && env.emailPassword && env.emailFrom); }
function getTransporter() {
  if (!configured()) throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASSWORD, and EMAIL_FROM.');
  if (!transporter) transporter = nodemailer.createTransport({ host: env.emailHost, port: env.emailPort, secure: env.emailSecure, auth: { user: env.emailUser, pass: env.emailPassword } });
  return transporter;
}
async function sendMail({ to, subject, text, html }) { const transport = getTransporter(); try { await transport.sendMail({ from: env.emailFrom, to, subject, text, html }); return true; } catch (error) { console.error({ event: 'email_delivery_failure', code: error.code || 'SMTP_ERROR' }); throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'The email could not be delivered. Check the server email configuration and try again.'); } }
module.exports = { sendMail, configured };
