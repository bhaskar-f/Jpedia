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

test('phase 1, 2, and 3 catalogs have matching keys in all supported languages', () => {
  for (const namespace of ['jobs', 'jobDetails', 'boards', 'examPreparation']) {
    const expected = leafKeys(locales.en[namespace]).sort();
    assert.ok(expected.length > 0, `${namespace} namespace has translations`);
    for (const locale of ['hi', 'bn'])
      assert.deepEqual(leafKeys(locales[locale][namespace]).sort(), expected, `${locale}.${namespace} keys match English`);
  }
});

test('board and preparation pagination messages provide plural forms and dynamic values', () => {
  for (const locale of ['en', 'hi', 'bn']) {
    for (const namespace of ['boards', 'examPreparation']) {
      const entry = locales[locale][namespace].pageResults;
      assert.equal(typeof entry.one, 'string');
      assert.equal(typeof entry.other, 'string');
      for (const form of [entry.one, entry.other]) {
        assert.match(form, /\{page\}/);
        assert.match(form, /\{count\}/);
      }
    }
  }
});

test('board and preparation UI has Hindi and Bengali text while supplied content stays direct', () => {
  for (const namespace of ['boards', 'examPreparation']) {
    assert.notEqual(locales.hi[namespace].title, locales.en[namespace].title);
    assert.notEqual(locales.bn[namespace].title, locales.en[namespace].title);
  }
  const pages = fs.readFileSync(path.join(root, 'public-pages.js'), 'utf8');
  const details = fs.readFileSync(path.join(root, 'board-details.js'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  assert.match(pages, /item\.title\);/);
  assert.match(pages, /if \(item\.description\) add\(card, "p", "", item\.description\)/);
  assert.match(pages, /new Option\(item\.name, item\._id\)/);
  assert.match(details, /el\(['"]h1['"], ['"]['"], board\.name\)/);
  assert.match(details, /el\(['"]p['"], ['"]['"], item\.description\)/);
  assert.match(details, /board\.officialWebsite/);
  assert.match(details, /item\.title\} ↗/);
  assert.doesNotMatch(pages, /(?<![A-Za-z])t\(\s*(?:item|board)\.(?:title|description|name|exam|slug|_id)/);
  assert.doesNotMatch(details, /(?<![A-Za-z])t\(\s*(?:item|board|job)\.(?:title|description|name|officialWebsite|slug|_id)/);
  assert.doesNotMatch(pages, /t\([^)]*,\s*\{[^}]*\b(?:title|name|description):\s*(?:item|board)\./);
  assert.doesNotMatch(details, /t\([^)]*,\s*\{[^}]*\b(?:title|name|description):\s*(?:item|board|job)\./);
  assert.match(home, /node\("strong", "", item\.name\)/);
  assert.match(home, /node\("span", "", item\.description\)/);
  assert.match(home, /node\("b", "", board\.name\)/);
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
