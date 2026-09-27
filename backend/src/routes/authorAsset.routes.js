const router = require('express').Router();
const controller = require('../controllers/authorAsset.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { asyncHandler } = require('../utils/http');
const { authorAsset } = require('../validators/schemas');
const setType = type => (req, res, next) => { req.assetType = type; next(); };

for (const [path, type] of [['templates', 'TEMPLATE'], ['saved-sections', 'SAVED_SECTION']]) {
  const roles=type==='TEMPLATE'?['AUTHOR','ADMIN','SUPER_ADMIN']:['AUTHOR'];
  router.get(`/${path}`, requireAuth, allowRoles(...roles), setType(type), asyncHandler(controller.list));
  router.post(`/${path}`, requireAuth, allowRoles(...roles), setType(type), validate(authorAsset), asyncHandler(controller.create));
  router.patch(`/${path}/:id`, requireAuth, allowRoles(...roles), setType(type), validate(authorAsset), asyncHandler(controller.update));
  router.delete(`/${path}/:id`, requireAuth, allowRoles(...roles), setType(type), asyncHandler(controller.remove));
}
module.exports = router;
