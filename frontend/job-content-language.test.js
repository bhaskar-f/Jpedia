const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { translatedJob } = require('../backend/src/fixtures/content-translated-job.fixture');

function languageApi() {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'job-content-language.js'), 'utf8'),
    context,
    { filename: 'job-content-language.js' },
  );
  return context.window.SetBGetJobContentLanguage;
}

test('stored content languages are available only when that section has text', () => {
  const api = languageApi();
  assert.deepEqual([...api.available({ hi: { description: 'हिंदी' } })], ['hi']);
  assert.deepEqual([...api.available({ bn: { description: 'বাংলা' } })], ['bn']);
  assert.deepEqual([...api.available({ hi: { description: 'हिंदी' }, bn: { description: 'বাংলা' } })], ['hi', 'bn']);
  assert.deepEqual([...api.available({ hi: { description: '  ' }, bn: {} })], []);
  assert.deepEqual([...api.available({ hi: { contentDocument: { key: 'हिंदी' } }, bn: { contentDocument: {} } })], ['hi']);
});

test('matching UI language is the initial content selection only when stored', () => {
  const api = languageApi();
  const hindiOnly = { hi: { description: 'हिंदी' } };
  const bengaliOnly = { bn: { description: 'বাংলা' } };
  assert.equal(api.initialLocale('hi', hindiOnly), 'hi');
  assert.equal(api.initialLocale('bn', bengaliOnly), 'bn');
  assert.equal(api.initialLocale('bn', hindiOnly), 'en');
  assert.equal(api.initialLocale('hi', {}), 'en');
});

test('missing stored field text falls back to source without mutating job data', () => {
  const api = languageApi();
  const job = { description: 'English source', contentTranslations: { hi: { description: 'हिंदी' } } };
  const before = JSON.stringify(job);
  assert.equal(api.value(job.contentTranslations.hi.description, job.description), 'हिंदी');
  assert.equal(api.value(job.contentTranslations.bn?.description, job.description), 'English source');
  assert.equal(JSON.stringify(job), before);
});

test('selecting stored content language leaves protected job facts unchanged', () => {
  const api = languageApi();
  const job = translatedJob();
  const protectedFacts = {
    title: job.title,
    organization: job.organization,
    vacancyCount: job.vacancyCount,
    applicationStartDate: job.applicationStartDate,
    applicationDeadline: job.applicationDeadline,
    applicationFee: job.applicationFee,
    salary: job.salary,
    officialApplyUrl: job.officialApplyUrl,
  };
  const originalJob = JSON.stringify(job);

  for (const locale of ['hi', 'bn']) {
    assert.notEqual(api.value(job.contentTranslations[locale].description, job.description), job.description);
    assert.deepEqual({
      title: job.title,
      organization: job.organization,
      vacancyCount: job.vacancyCount,
      applicationStartDate: job.applicationStartDate,
      applicationDeadline: job.applicationDeadline,
      applicationFee: job.applicationFee,
      salary: job.salary,
      officialApplyUrl: job.officialApplyUrl,
    }, protectedFacts);
  }

  assert.equal(api.value(job.contentTranslations.hi.howToApplySteps[1], job.howToApplySteps[1]), 'आवेदन पत्र पूरा करके अंतिम तिथि से पहले जमा करें।');
  assert.equal(api.value(job.contentTranslations.bn.howToApplySteps[1], job.howToApplySteps[1]), 'আবেদনপত্র পূরণ করে শেষ তারিখের আগে জমা দিন।');
  assert.equal(JSON.stringify(job), originalJob);
});
