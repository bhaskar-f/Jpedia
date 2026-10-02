const mongoose = require('mongoose');

function createConnectionManager(connector, connection) {
  let pending;
  return async function connect(uri) {
    if (connection.readyState === 1) return connection;
    if (pending) return pending;
    pending = connector(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
    })
      .then(() => {
        pending = undefined;
        return connection;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };
}

mongoose.set('strictQuery', true);
const connectDatabase = createConnectionManager(
  (uri, options) => mongoose.connect(uri, options),
  mongoose.connection,
);

let logged = false;
async function connectAndLog(uri) {
  await connectDatabase(uri);
  if (!logged) {
    logged = true;
    console.info(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
  }
  return mongoose.connection;
}

module.exports = { connectDatabase: connectAndLog, createConnectionManager };
