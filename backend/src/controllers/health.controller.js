const { success } = require('../utils/http');
const mongoose = require('mongoose');

function health(req, res) {
  return success(res, { status: 'ok', timestamp: new Date().toISOString() });
}

function ready(req, res) {
  const connected = mongoose.connection.readyState === 1;
  return res.status(connected ? 200 : 503).json({
    success: connected,
    data: { status: connected ? 'ok' : 'database_unavailable', timestamp: new Date().toISOString() },
  });
}

module.exports = { health, ready };
