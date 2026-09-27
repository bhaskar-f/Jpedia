const { Application, Job, User, SavedJob, Notification } = require('../models');
const { notify } = require('./notification.service');
async function deliverApplicationReminders() {
  const due = await Application.find({ reminderDate: { $lte: new Date() }, reminderSentAt: null }).populate('user').populate('job').limit(500);
  for (const application of due) {
    if (!application.user || !application.job) { application.reminderSentAt = new Date(); await application.save(); continue; }
    await notify({ user: application.user, type: 'APPLICATION_REMINDER', title: `Reminder: ${application.job.title}`, message: application.notes || `You have a reminder for ${application.job.title}.`, relatedJob: application.job._id, relatedApplication: application._id, channels: ['website','email','sms'] });
    application.reminderSentAt = new Date(); await application.save();
  }
  return due.length;
}
async function deliverDeadlineNotifications() {
  const now = new Date(); const deadline = new Date(now.getTime() + 3 * 86400000);
  const jobs = await Job.find({ status: 'PUBLISHED', applicationDeadline: { $gt: now, $lte: deadline } }).limit(500);
  let delivered = 0;
  for (const job of jobs) {
    const [saved, users] = await Promise.all([SavedJob.find({ job: job._id }).populate('user').limit(1000), User.find({ isActive: true, $or: [{ preferredExams: { $in: [job.category, ...job.tags] } }, { preferredJobCategories: { $in: [job.category, ...job.tags] } }] }).limit(1000)]);
    const recipients = new Map(); for (const entry of saved) if (entry.user) recipients.set(String(entry.user._id), entry.user); for (const user of users) recipients.set(String(user._id), user);
    for (const user of recipients.values()) {
      const recent = await Notification.exists({ user: user._id, relatedJob: job._id, type: 'JOB_DEADLINE', createdAt: { $gte: new Date(now.getTime() - 24 * 3600000) } }); if (recent) continue;
      await notify({ user, type: 'JOB_DEADLINE', title: `Deadline approaching: ${job.title}`, message: `${job.title} closes on ${job.applicationDeadline.toISOString().slice(0,10)}. Verify the official notice before applying.`, relatedJob: job._id, channels: ['website','email','sms'] }); delivered++;
    }
  }
  return delivered;
}
module.exports = { deliverApplicationReminders, deliverDeadlineNotifications };
