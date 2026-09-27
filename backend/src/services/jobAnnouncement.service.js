const { User, Application, Notification, NotificationPreference } = require('../models');
const { evaluateJobMatch } = require('./jobMatch.service');

async function announcePublishedJob(job) {
  const applications = await Application.find({ job: job._id }).select('user status').lean();
  const byUser = new Map(applications.map(item => [String(item.user), item]));
  const profiles = User.find({ role: 'USER', $or: [{ isActive: true }, { isActive: { $exists: false } }] })
    .select('_id preferences education preferredExams preferredJobCategories location dateOfBirth')
    .lean().cursor({ batchSize: 250 });
  for await (const user of profiles) {
    const match = evaluateJobMatch(job, user, byUser.get(String(user._id)));
    if (!match.matched && match.level !== 'PREFERENCE_MATCH') continue;
    const preference = await NotificationPreference.findOne({ user: user._id }).select('jobMatches').lean();
    if (preference?.jobMatches === false) continue;
    const dedupeKey = `${user._id}:${job._id}:JOB_POTENTIAL_MATCH`;
    const explanation = match.reasons.length ? `Potential match because: ${match.reasons.join('; ')}.` : 'Potential match based on your saved profile.';
    const evaluation = match.unknown.length
      ? ` Eligibility could not be fully evaluated: ${match.unknown.join('; ')}.`
      : ' Available profile criteria were reviewed, but this is not an official eligibility decision.';
    try {
      await Notification.findOneAndUpdate({ dedupeKey }, { $setOnInsert: {
        user: user._id, type: 'JOB_POTENTIAL_MATCH', title: `Potential match: ${job.title}`,
        message: `${explanation}${evaluation} Review the official notice.`,
        relatedJob: job._id, dedupeKey, published: true, read: false,
      } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}

module.exports = { announcePublishedJob };
