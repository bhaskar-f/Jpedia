const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = __dirname;
function build(env) {
  return spawnSync(process.execPath, ['build.js'], { cwd: root, env, encoding: 'utf8' });
}

test('Vercel builds require an explicit public API URL and embed only that URL', () => {
  const missing = { ...process.env, VERCEL: '1' };
  delete missing.PUBLIC_API_BASE_URL;
  const rejected = build(missing);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /PUBLIC_API_BASE_URL/);

  const preview = build({ ...process.env, VERCEL: '1', PUBLIC_API_BASE_URL: 'https://api-preview.example/api' });
  assert.equal(preview.status, 0, preview.stderr);
  const config = fs.readFileSync(path.join(root, 'public', 'api-config.js'), 'utf8');
  assert.ok(config.includes('https://api-preview.example/api'));
  assert.doesNotMatch(config, /SECRET|MONGODB|PASSWORD|JWT_/);
  assert.ok(fs.existsSync(path.join(root, 'public', 'i18n.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'job-content-language.js')));
  for (const locale of ['en', 'hi', 'bn'])
    assert.ok(fs.existsSync(path.join(root, 'public', 'locales', `${locale}.json`)));
});
