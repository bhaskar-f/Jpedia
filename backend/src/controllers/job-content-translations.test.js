const test = require('node:test');
const assert = require('node:assert/strict');
const { Job } = require('../models');
const { job: jobSchema } = require('../validators/schemas');
const { getPublic } = require('./job.controller');
const { mergeContentTranslations } = require('../services/job.service');
const {
  translatedJob,
  hindiOnlyJob,
  bengaliOnlyJob,
  untranslatedJob,
} = require('../fixtures/content-translated-job.fixture');

async function validatedPublishedJob(data) {
  // Slugs are service-generated and boardName is model/projection data, so
  // validate the submitted job fields before adding those model-only values.
  const { _id, slug, boardName, ...submittedFields } = data;
  const parsed = jobSchema.parse(submittedFields);
  const job = new Job({ _id, ...parsed, slug, boardName, status: 'PUBLISHED' });
  await job.validate();
  return job;
}

async function publicResponse(job) {
  const originalFindOne = Job.findOne;
  let queryFilter;
  Job.findOne = filter => {
    queryFilter = filter;
    const query = {
      populate() { return query; },
      then(resolve, reject) { return Promise.resolve(job).then(resolve, reject); },
    };
    return query;
  };

  try {
    let response;
    const res = {
      status(status) { this.statusCode = status; return this; },
      json(body) { response = body; return body; },
    };
    await getPublic({ params: { id: 'junior-engineer-recruitment-2026-fixture' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(queryFilter.status, { $in: ['PUBLISHED', 'EXPIRED'] });
    return response.data;
  } finally {
    Job.findOne = originalFindOne;
  }
}

const factualFields = [
  'title',
  'organization',
  'vacancyCount',
  'applicationStartDate',
  'applicationDeadline',
  'applicationFee',
  'salary',
  'officialApplyUrl',
];

test('public job detail response includes stored translations and preserves factual source fields', async () => {
  const job = await validatedPublishedJob(translatedJob());
  const response = await publicResponse(job);

  assert.deepEqual(response.contentTranslations.hi.howToApplySteps, [
    'मान्य ईमेल पते और मोबाइल नंबर से पंजीकरण करें।',
    'आवेदन पत्र पूरा करके अंतिम तिथि से पहले जमा करें।',
  ]);
  assert.deepEqual(response.contentTranslations.bn.importantDates, [
    { description: 'আবেদন পোর্টাল সকাল ১০টায় খুলবে।' },
    { description: 'পোর্টাল বন্ধ হওয়ার আগে সম্পূর্ণ আবেদন জমা দিন।' },
  ]);
  assert.ok(response.contentTranslations.hi.ageRelaxation);
  assert.equal(response.contentTranslations.bn.ageRelaxation, undefined);
  assert.ok(response.contentTranslations.bn.salaryInfo.description);
  assert.equal(response.contentTranslations.hi.salaryInfo, undefined);
  const flattenedJob = job.toObject({ flattenMaps: true });
  assert.deepEqual(response.contentTranslations.hi.contentDocument, flattenedJob.contentTranslations.hi.contentDocument);
  assert.deepEqual(response.contentDocument, flattenedJob.contentDocument);

  for (const field of factualFields) {
    assert.deepEqual(response[field], job[field], `${field} should stay canonical English/source data`);
  }
  assert.equal(response.title, 'Junior Engineer Recruitment 2026');
  assert.equal(response.organization, 'National Public Works Board');
  assert.equal(response.vacancyCount, 240);
  assert.equal(response.applicationFee, '₹100 for General and OBC candidates; exempt for SC, ST, and women candidates.');
  assert.equal(response.officialApplyUrl, 'https://recruitment.example.gov.in/junior-engineer/apply');
});

test('public job detail response without translations remains available and omits the optional field', async () => {
  const job = await validatedPublishedJob(untranslatedJob());
  const response = await publicResponse(job);

  assert.equal(response.description, job.description);
  assert.equal(response.contentTranslations, undefined);
});

test('Hindi-only and Bengali-only fixtures validate and are represented independently in public responses', async () => {
  const hiResponse = await publicResponse(await validatedPublishedJob(hindiOnlyJob()));
  assert.ok(hiResponse.contentTranslations.hi.description);
  assert.equal(hiResponse.contentTranslations.bn, undefined);
  assert.ok(hiResponse.contentTranslations.hi.ageRelaxation);
  assert.equal(hiResponse.contentTranslations.bn?.ageRelaxation, undefined);

  const bnResponse = await publicResponse(await validatedPublishedJob(bengaliOnlyJob()));
  assert.ok(bnResponse.contentTranslations.bn.description);
  assert.equal(bnResponse.contentTranslations.hi, undefined);
  assert.ok(bnResponse.contentTranslations.bn.howToApplySteps);
});

test('translated structured items remain aligned to their source item positions', async () => {
  const job = await validatedPublishedJob(translatedJob());
  const response = await publicResponse(job);

  assert.equal(response.howToApplySteps[0], 'Register with a valid email address and mobile number.');
  assert.equal(response.contentTranslations.hi.howToApplySteps[0], 'मान्य ईमेल पते और मोबाइल नंबर से पंजीकरण करें।');
  assert.equal(response.contentTranslations.hi.howToApplySteps[1], 'आवेदन पत्र पूरा करके अंतिम तिथि से पहले जमा करें।');
  assert.equal(response.importantDates[1].event, 'Last date to apply');
  assert.equal(response.contentTranslations.bn.importantDates[1].description, 'পোর্টাল বন্ধ হওয়ার আগে সম্পূর্ণ আবেদন জমা দিন।');
});

test('structured translation updates preserve rich-document maps in both locales', async () => {
  const job = await validatedPublishedJob(translatedJob());
  const existing = job.contentTranslations;
  job.contentTranslations = mergeContentTranslations(existing, { hi: { description: 'अपडेट किया गया विवरण' } });
  await job.validate();
  const stored = job.toObject({ flattenMaps: true }).contentTranslations;
  assert.equal(stored.hi.description, 'अपडेट किया गया विवरण');
  assert.ok(stored.hi.contentDocument);
  assert.ok(stored.bn.contentDocument);
});
