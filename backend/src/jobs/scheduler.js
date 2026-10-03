const cron = require('node-cron');
const { env } = require('../config/env');
const { runTask } = require('./automation');

const SCHEDULES = [
  ['recruitment', env.recruitmentCron],
  ['application-reminders', '*/15 * * * *'],
  ['deadline-notifications', '11 2 * * *'],
  ['expire-jobs', '17 1 * * *'],
];

function startSchedulers() {
  if (process.env.VERCEL === '1') return false;
  if (process.env.RAILWAY_SERVICE_ROLE && process.env.RAILWAY_SERVICE_ROLE !== 'worker') return false;
  for (const [task, schedule] of SCHEDULES) {
    if (!cron.validate(schedule)) throw new Error(`Schedule for ${task} is invalid.`);
    cron.schedule(schedule, () => runTask(task).catch(error => console.error({ event: 'scheduled_task_error', task, errorType: error.name || 'Error', code: error.code })), { noOverlap: true });
  }
  console.info(`Background tasks scheduled (${env.recruitmentCron} recruitment schedule).`);
  return true;
}

module.exports = { SCHEDULES, startSchedulers };
