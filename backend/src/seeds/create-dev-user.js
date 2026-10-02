require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { User, NotificationPreference } = require('../models');

async function main() {
  const {
    MONGODB_URI,
    DEV_USER_NAME,
    DEV_USER_EMAIL,
    DEV_USER_PASSWORD,
    DEV_USER_PHONE
  } = process.env;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from .env');
  }

  if (!DEV_USER_EMAIL || !DEV_USER_PASSWORD) {
    throw new Error(
      'DEV_USER_EMAIL and DEV_USER_PASSWORD are required in .env'
    );
  }

  if (DEV_USER_PASSWORD.length < 12) {
    throw new Error('DEV_USER_PASSWORD must be at least 12 characters.');
  }

  const email = DEV_USER_EMAIL.trim().toLowerCase();

  await mongoose.connect(MONGODB_URI);

  let user = await User.findOne({ email }).select('+passwordHash');

  if (user) {
    user.name = DEV_USER_NAME || user.name || 'SetBGet Test User';
    user.phoneNumber = DEV_USER_PHONE || user.phoneNumber;

    // Development account is intentionally verified.
    user.isEmailVerified = true;
    user.isPhoneVerified = true;
    user.isActive = true;

    // Keep this account as a normal USER.
    user.role = 'USER';

    user.passwordHash = await bcrypt.hash(DEV_USER_PASSWORD, 12);

    await user.save();

    console.log('Development user updated.');
  } else {
    const passwordHash = await bcrypt.hash(DEV_USER_PASSWORD, 12);

    user = await User.create({
      name: DEV_USER_NAME || 'SetBGet Test User',
      email,
      phoneNumber: DEV_USER_PHONE || undefined,
      passwordHash,

      role: 'USER',

      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,

      authTokenVersion: 0
    });

    await NotificationPreference.create({
      user: user._id
    });

    console.log('Development user created.');
  }

  console.log('');
  console.log('Development login:');
  console.log(`Email:    ${email}`);
  console.log('Password: use the value configured in .env.');
  console.log(`Role:     ${user.role}`);
  console.log(`Verified: yes`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Failed to create development user.');
  console.error({ errorType: error.name || 'Error', code: error.code });

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
