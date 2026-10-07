const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const jobRoutes = require('./job.routes');

const translationKey = '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1';

// Mirrors the JSON emitted by readDocument() and blocksEditor.readTranslations()
// in frontend/admin.js when Author clicks Save Draft.
const authorSaveDraftPayload = JSON.parse(JSON.stringify({
  contentDocument: [
    {
      type: 'h2',
      attrs: { id: 'heading-application-steps' },
      content: [{ type: 'span', text: 'Application steps' }],
    },
    {
      type: 'p',
      content: [{ type: 'span', text: 'Submit the application online.', translationKey }],
    },
    {
      type: 'p',
      content: [{ type: 'a', attrs: { href: 'https://example.gov/apply' }, content: [{ type: 'span', text: 'Apply online' }] }],
    },
  ],
  contentTranslations: {
    hi: { contentDocument: { [translationKey]: 'आवेदन ऑनलाइन जमा करें।' } },
    bn: { contentDocument: { [translationKey]: 'অনলাইনে আবেদন জমা দিন।' } },
  },
}));

function actualJobRoute(method, routePath) {
  const layer = jobRoutes.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${routePath} to be registered on the jobs router`);
  return layer;
}

async function runAttachedValidator(route, body) {
  // Both create and edit routes are registered as auth, role, validate, controller.
  // Invoke the validator middleware attached to the real route, not a separately
  // imported schema that could drift away from route wiring.
  const validator = route.route.stack[2].handle;
  const req = { body: structuredClone(body) };
  await new Promise((resolve, reject) => validator(req, {}, (error) => error ? reject(error) : resolve()));
  return req.body;
}

test('Author create and edit route validators accept the browser Save Draft payload', async () => {
  const mount = app._router.stack.find((layer) => layer.handle === jobRoutes);
  assert.ok(mount, 'The jobs router must be mounted by the application');
  assert.match(String(mount.regexp), /api\\\/jobs/);

  const create = actualJobRoute('post', '/');
  const edit = actualJobRoute('patch', '/:id');
  assert.deepEqual(await runAttachedValidator(create, authorSaveDraftPayload), authorSaveDraftPayload);
  assert.deepEqual(await runAttachedValidator(edit, authorSaveDraftPayload), authorSaveDraftPayload);
});

test('Author route validator still rejects translation keys without a marked source span', async () => {
  const invalidPayload = {
    ...authorSaveDraftPayload,
    contentDocument: [{ type: 'p', content: [{ type: 'span', text: 'Unmarked source' }] }],
  };
  await assert.rejects(
    runAttachedValidator(actualJobRoute('post', '/'), invalidPayload),
    (error) => error.code === 'VALIDATION_ERROR' && error.details.issues.some((issue) => issue.path.join('.') === `contentTranslations.hi.contentDocument.${translationKey}`),
  );
});
