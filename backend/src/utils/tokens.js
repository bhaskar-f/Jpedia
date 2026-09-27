const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
function randomToken() { return crypto.randomBytes(32).toString('hex'); }
function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function signAccess(user) { return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.accessTtl, issuer: 'j-info' }); }
function signRefresh(user, jti) { return jwt.sign({ sub: user.id, jti }, env.jwtRefreshSecret, { expiresIn: `${env.refreshDays}d`, issuer: 'j-info' }); }
module.exports = { randomToken, hashToken, signAccess, signRefresh };
