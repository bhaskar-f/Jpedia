const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const locales = Object.fromEntries(['en', 'hi', 'bn'].map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(path.join(root, 'locales', `${locale}.json`), 'utf8')),
]));

function leafKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? leafKeys(child, pathKey)
      : [pathKey];
  });
}

test('jobs and jobDetails catalogs have matching translated keys in all supported languages', () => {
  for (const namespace of ['jobs', 'jobDetails']) {
    const expected = leafKeys(locales.en[namespace]).sort();
    assert.ok(expected.length > 0, `${namespace} namespace has translations`);
    for (const locale of ['hi', 'bn'])
      assert.deepEqual(leafKeys(locales[locale][namespace]).sort(), expected, `${locale}.${namespace} keys match English`);
  }
});

test('job listing plural and interpolation catalog entries include dynamic values', () => {
  for (const locale of ['en', 'hi', 'bn']) {
    const entry = locales[locale].jobs.pageResults;
    assert.equal(typeof entry.one, 'string');
    assert.equal(typeof entry.other, 'string');
    assert.match(entry.one, /\{page\}/);
    assert.match(entry.one, /\{count\}/);
    assert.match(entry.other, /\{page\}/);
    assert.match(entry.other, /\{count\}/);
  }
});

test('job titles and authored job content are kept out of translation lookups', () => {
  const details = fs.readFileSync(path.join(root, 'job-details.js'), 'utf8');
  const content = fs.readFileSync(path.join(root, 'job-content.js'), 'utf8');
  assert.doesNotMatch(details, /\bt\(\s*job\.(?:title|organization|description|officialWebsite|officialNotificationUrl)/);
  assert.doesNotMatch(details, /\bt\([^\n]*\{[^\n]*(?:title|organization):\s*job\./);
  assert.doesNotMatch(content, /\bt\(\s*(?:job|post|item|block)\.(?:name|title|description|body|url)/);
  assert.match(details, /el\("h1",\s*"",\s*job\.title\)/);
  assert.match(details, /el\("p",\s*"job-detail-paragraph",\s*job\.description\)/);
});
