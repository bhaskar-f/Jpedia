const test = require('node:test');
const assert = require('node:assert/strict');
const { createConnectionManager } = require('./database');

test('Mongo connection manager shares concurrent and warm-instance connections', async () => {
  const connection = { readyState: 0 };
  let calls = 0;
  let resolveConnect;
  const connect = createConnectionManager(() => {
    calls++;
    return new Promise(resolve => { resolveConnect = () => { connection.readyState = 1; resolve(); }; });
  }, connection);
  const first = connect('mongodb://db/jpedia');
  const second = connect('mongodb://db/jpedia');
  assert.equal(calls, 1);
  resolveConnect();
  assert.equal(await first, connection);
  assert.equal(await second, connection);
  assert.equal(await connect('mongodb://db/jpedia'), connection);
  assert.equal(calls, 1);
});

test('Mongo connection manager clears a failed connection promise for retry', async () => {
  const connection = { readyState: 0 };
  let calls = 0;
  const connect = createConnectionManager(async () => {
    calls++;
    if (calls === 1) throw new Error('temporary connection failure');
    connection.readyState = 1;
  }, connection);
  await assert.rejects(connect('mongodb://db/jpedia'), /temporary/);
  assert.equal(await connect('mongodb://db/jpedia'), connection);
  assert.equal(calls, 2);
});
