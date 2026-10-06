const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('./validate.middleware');
const { jobDraft } = require('../validators/schemas');

test('validation middleware retains exact nested Zod paths for client diagnostics', () => {
  const invalidKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const req = {
    body: {
      contentDocument: [{ type: 'p', content: [{ type: 'span', text: 'Apply online.', translationKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] }],
      contentTranslations: { hi: { contentDocument: { [invalidKey]: 'आवेदन करें।' } } },
    },
  };
  let captured;
  validate(jobDraft)(req, {}, (error) => { captured = error; });
  assert.equal(captured.code, 'VALIDATION_ERROR');
  assert.ok(captured.details.issues.some((issue) =>
    issue.path.join('.') === `contentTranslations.hi.contentDocument.${invalidKey}` &&
    issue.message === 'Translation key does not refer to a marked text run in contentDocument.',
  ));
});
