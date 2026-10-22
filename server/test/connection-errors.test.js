import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(db, run) {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('connection failures return an actionable message without database details', async () => {
  await withServer({
    execute: async () => { throw Object.assign(new Error('private connection details'), { code: 'HANDSHAKE_SSL_ERROR' }); },
  }, async base => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'DB_CONNECTION_FAILED');
    assert.ok(!JSON.stringify(body).includes('private'));
  });
});

test('register preserves the connection error when rollback also fails and never retries a write', async () => {
  let attempts = 0;
  let destroyed = false;
  let released = false;
  await withServer({
    getConnection: async () => ({
      beginTransaction: async () => {},
      execute: async () => { attempts++; throw Object.assign(new Error('reset'), { code: 'ECONNRESET' }); },
      rollback: async () => { throw new Error('closed'); },
      destroy: () => { destroyed = true; },
      release: () => { released = true; },
    }),
  }, async base => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.invalid', password: 'test-password-12345', displayName: 'Test' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'DB_CONNECTION_FAILED');
    assert.equal(attempts, 1);
    assert.ok(destroyed && released);
  });
});
