const { success } = require('../utils/http');

function health(req, res) {
  return success(res, { status: 'ok', timestamp: new Date().toISOString() });
}

module.exports = { health };
