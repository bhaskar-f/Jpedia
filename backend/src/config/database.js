const mongoose = require('mongoose');
async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.info(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
}
module.exports = { connectDatabase };
