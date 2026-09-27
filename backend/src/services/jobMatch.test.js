const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateJobMatch } = require('./jobMatch.service');

const user = { preferences: {
  education: { level: 'BACHELORS', degrees: ['BSc'], fields: ['Physics'] },
  location: { state: 'Maharashtra', district: 'Pune' },
  jobCategories: ['Science'], preferredBoards: ['UPSC'],
} };
const base = { title: 'Scientific Officer', board: { name: 'UPSC' }, category: 'Science',
  location: 'Pune, Maharashtra', qualification: "Bachelor's degree in Physics" };

test('matches configured qualification, board, category, and district preferences', () => {
  const result = evaluateJobMatch(base, user);
  assert.equal(result.matched, true);
  assert.equal(result.level, 'POTENTIAL_MATCH');
});

test('rejects an explicit incompatible qualification and location', () => {
  assert.equal(evaluateJobMatch({ ...base, qualification: 'Master of Law' }, user).level, 'INCOMPATIBLE');
  assert.equal(evaluateJobMatch({ ...base, location: 'Gujarat' }, user).level, 'INCOMPATIBLE');
});

test('all India openings can match while unknown profile criteria remain explicit', () => {
  const result = evaluateJobMatch({ ...base, location: 'All India', qualification: '' }, user);
  assert.equal(result.level, 'PREFERENCE_MATCH');
  assert.match(result.unknown.join(' '), /qualification/);
});

test('does not recommend closed or already tracked jobs', () => {
  assert.equal(evaluateJobMatch({ ...base, applicationDeadline: new Date(Date.now() - 1000) }, user).level, 'CLOSED');
  assert.equal(evaluateJobMatch(base, user, { status: 'APPLIED' }).level, 'ALREADY_TRACKED');
});
