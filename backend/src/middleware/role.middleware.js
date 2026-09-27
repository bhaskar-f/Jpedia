const { AppError } = require('../utils/http');
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
  next();
};
const adminOnly = allowRoles('ADMIN', 'SUPER_ADMIN');
const superAdminOnly = allowRoles('SUPER_ADMIN');
module.exports = { allowRoles, adminOnly, superAdminOnly };
