const test = require('node:test');
const assert = require('node:assert/strict');
const { profile } = require('./schemas');

test('profile preferences accept supported taxonomy and district data', () => {
  const result = profile.safeParse({ preferences: {
    education: { level: 'BACHELORS', degrees: ['BSc'], fields: ['Physics'] },
    location: { state: 'Maharashtra', district: 'Pune' },
    jobCategories: ['Research / Science'], preferredBoards: ['UPSC'],
  } });
  assert.equal(result.success, true);
});

test('profile preferences reject unknown state, mismatched district, and role injection', () => {
  assert.equal(profile.safeParse({ preferences: { location: { state: 'Atlantis' } } }).success, false);
  assert.equal(profile.safeParse({ preferences: { location: { state: 'Maharashtra', district: 'Chennai' } } }).success, false);
  assert.equal(profile.safeParse({ role: 'ADMIN' }).success, false);
});

test('profile validation rejects invalid level, degree-for-level, field, category, and board values', () => {
  const invalid = [
    { education: { level: 'MADE_UP' } },
    { education: { level: 'BACHELORS', degrees: ['MSc'] } },
    { education: { fields: ['Made-up discipline'] } },
    { jobCategories: ['Made-up category'] },
    { preferredBoards: ['Made-up board'] },
  ];
  invalid.forEach(preferences => assert.equal(profile.safeParse({ preferences }).success, false));
});
