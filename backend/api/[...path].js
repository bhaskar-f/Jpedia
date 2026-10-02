const app = require('../src/app');
const { env, validateEnv } = require('../src/config/env');
const { connectDatabase } = require('../src/config/database');
const { ensureJobSearchIndex } = require('../src/config/atlasSearch');
const { createVercelHandler } = require('../src/config/vercel-handler');

async function initializeApplication() {
  validateEnv();
  await connectDatabase(env.mongoUri);
  await ensureJobSearchIndex();
}

module.exports = createVercelHandler({ application: app, initialize: initializeApplication });
