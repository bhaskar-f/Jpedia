const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const adminScript = fs.readFileSync(path.join(__dirname, 'admin.js'), 'utf8');
const publicPagesScript = fs.readFileSync(path.join(__dirname, 'public-pages.js'), 'utf8');
const mainScript = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

test('admin URLs synchronously claim the static shell before deferred app scripts run', () => {
  const adminBootstrap = indexHtml.indexOf('document.body.classList.add("admin-shell")');
  const siteHeader = indexHtml.indexOf('<header class="site-header">');
  const adminScriptTag = indexHtml.indexOf('<script src="/admin.js" defer></script>');
  const firstOtherDeferredScript = indexHtml.indexOf('<script src="/i18n.js" defer></script>');

  assert.ok(adminBootstrap >= 0 && adminBootstrap < siteHeader);
  assert.ok(adminScriptTag >= 0 && adminScriptTag < firstOtherDeferredScript);
  assert.match(adminScript, /\^\\\/admin/);
  assert.match(adminScript, /\^\\\/admin\\\/jobs\\\/\[\^\/\]\+\\\/edit\$/);
});

test('public dispatchers do not claim admin URLs', () => {
  assert.doesNotMatch(mainScript, /window\.location\.pathname\.startsWith\(["']\/admin/);
  assert.match(publicPagesScript, /if \(!root \|\| \(!routePaths\.includes\(path\)/);
  assert.doesNotMatch(publicPagesScript, /routePaths\s*=\s*\[[^\]]*["']\/admin/);
});
