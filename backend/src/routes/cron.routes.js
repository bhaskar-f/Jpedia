const router = require('express').Router();
const crypto = require('crypto');
const { env } = require('../config/env');
const { TASKS, runTask } = require('../jobs/automation');
const { AppError, success } = require('../utils/http');
const { asyncHandler } = require('../utils/http');

function createCronAuth(secret) {
  return (req, res, next) => {
    if (!secret) return res.status(503).json({ success: false, error: { code: 'CRON_NOT_CONFIGURED', message: 'Scheduled tasks are not configured.' } });
    const supplied = req.get('authorization') || '';
    const expected = `Bearer ${secret}`;
    const suppliedBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (suppliedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(suppliedBytes, expectedBytes))
      return res.status(401).json({ success: false, error: { code: 'CRON_UNAUTHORIZED', message: 'Unauthorized.' } });
    next();
  };
}

function createTaskHandler(execute = runTask) {
  return asyncHandler(async (req, res) => {
    if (!Object.hasOwn(TASKS, req.params.task)) throw new AppError(404, 'CRON_TASK_NOT_FOUND', 'Scheduled task not found.');
    const result = await execute(req.params.task);
    success(res, { task: req.params.task, ...result });
  });
}

function createCronRouter({ secret = env.cronSecret, execute = runTask } = {}) {
  const cronRouter = require('express').Router();
  cronRouter.get('/:task', createCronAuth(secret), createTaskHandler(execute));
  return cronRouter;
}

router.use(createCronRouter());
module.exports = router;
module.exports.createCronRouter = createCronRouter;
module.exports.createCronAuth = createCronAuth;
module.exports.createTaskHandler = createTaskHandler;
