require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("./src/models/User"); // adjust path if necessary

async function reset() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    console.log("Super Admin not found:", email);
    process.exit(1);
  }

  user.password = await bcrypt.hash(password, 12);
  user.role = "SUPER_ADMIN";
  user.emailVerified = true;

  await user.save();

  console.log("Super Admin password reset successfully.");
  process.exit(0);
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});