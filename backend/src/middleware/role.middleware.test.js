const test = require('node:test');
const assert = require('node:assert/strict');
const { allowRoles, adminOnly, superAdminOnly } = require('./role.middleware');

function authorize(middleware, role) {
  let passed = false;
  let error = null;
  middleware({ user: role ? { role } : null }, {}, value => {
    if (value) error = value;
    else passed = true;
  });
  return { passed, error };
}

test('author-only operations admit authors and reject users and admins', () => {
  assert.equal(authorize(allowRoles('AUTHOR'), 'AUTHOR').passed, true);
  for (const role of ['USER', 'ADMIN', 'SUPER_ADMIN']) {
    const result = authorize(allowRoles('AUTHOR'), role);
    assert.equal(result.passed, false);
    assert.equal(result.error.status, 403);
  }
});

test('admin operations admit admins and super admins but reject user and author roles', () => {
  assert.equal(authorize(adminOnly, 'ADMIN').passed, true);
  assert.equal(authorize(adminOnly, 'SUPER_ADMIN').passed, true);
  for (const role of ['USER', 'AUTHOR']) {
    const result = authorize(adminOnly, role);
    assert.equal(result.passed, false);
    assert.equal(result.error.status, 403);
  }
});

test('super-admin operations reject every lower role and unauthenticated requests', () => {
  assert.equal(authorize(superAdminOnly, 'SUPER_ADMIN').passed, true);
  for (const role of ['USER', 'AUTHOR', 'ADMIN', null]) {
    const result = authorize(superAdminOnly, role);
    assert.equal(result.passed, false);
    assert.equal(result.error.status, 403);
  }
});
