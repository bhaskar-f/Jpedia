const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User } = require('../backend/src/models');

async function reset() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in backend/.env.');
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) throw new Error('Configured Super Admin account was not found.');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.role = 'SUPER_ADMIN';
  user.isEmailVerified = true;
  await user.save();
  console.info('Super Admin password reset successfully.');
}

reset().catch(error => {
  console.error({ event: 'super_admin_reset_failure', errorType: error.name || 'Error', code: error.code || 'RESET_FAILED' });
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
