import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/auth.js';

function fakeDatabase() {
  const users = new Map(), profiles = new Map(), sessions = new Map(), trips = [];
  let snapshot;
  const db = {
    getConnection: async () => db,
    beginTransaction: async () => { snapshot = new Map(profiles); },
    commit: async () => {},
    rollback: async () => { profiles.clear(); for (const entry of snapshot) profiles.set(...entry); },
    release() {},
    async execute(sql, args = []) {
      if (sql.startsWith('INSERT INTO profiles')) { profiles.set(args[0], args[1]); return [{}]; }
      if (sql.startsWith('INSERT INTO auth_users')) {
        if (users.has(args[1])) throw Object.assign(new Error(), { code: 'ER_DUP_ENTRY' });
        users.set(args[1], { profile_id: args[0], email: args[1], password_hash: args[2], display_name: profiles.get(args[0]) });
        return [{}];
      }
      if (sql.startsWith('INSERT INTO auth_sessions')) { sessions.set(args[0], { id: args[1], expiry: args[2] }); return [{}]; }
      if (sql.includes('FROM auth_sessions s')) {
        const session = sessions.get(args[0]);
        const user = [...users.values()].find((u) => u.profile_id === session?.id);
        return [session && session.expiry > new Date() && user ? [{ id: user.profile_id, email: user.email, display_name: user.display_name }] : []];
      }
      if (sql.includes('FROM auth_users u')) return [users.has(args[0]) ? [users.get(args[0])] : []];
      if (sql.startsWith('DELETE FROM auth_sessions')) { sessions.delete(args[0]); return [{}]; }
      if (sql.startsWith('INSERT INTO trips')) { trips.push({ id: String(trips.length + 1), owner_id: args[0], title: args[1] }); return [{ insertId: trips.length }]; }
      if (sql.includes('FROM trips')) return [trips.filter((trip) => trip.owner_id === args[0])];
      if (sql === 'SELECT 1') return [[{ result: 1 }]];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    profiles, sessions,
  };
  return db;
}
async function withApi(run) {
  const db = fakeDatabase();
  const server = createApp(db, { origins: ['http://localhost:5173'] }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  async function call(path, method = 'GET', body, token, extra = {}) {
    return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  try { await run(call, db); } finally { await new Promise((resolve) => server.close(resolve)); }
}
const registration = (email) => ({ email, password: 'safe-test-password-123', displayName: '旅行ユーザー' });

test('salted password hash verifies without storing plaintext', async () => {
  const a = await hashPassword('safe-test-password-123'), b = await hashPassword('safe-test-password-123');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('safe-test-password-123', a), true);
  assert.equal(await verifyPassword('wrong-password', a), false);
});
test('register, login, me, ownership, logout and expired sessions', async () => withApi(async (call, db) => {
  assert.equal((await call('/trips')).status, 401);
  const response = await call('/auth/register', 'POST', registration('A@example.com'));
  assert.equal(response.status, 201);
  const a = await response.json();
  assert.equal(a.user.email, 'a@example.com');
  assert.equal(a.user.password_hash, undefined);
  assert.equal(db.sessions.has(a.token), false);
  assert.equal((await call('/auth/me', 'GET', null, a.token)).status, 200);
  assert.equal((await call('/trips', 'POST', { title: '京都', owner_id: '1' }, a.token)).status, 400);
  assert.equal((await call('/trips', 'POST', { title: '京都' }, a.token)).status, 201);
  const b = await (await call('/auth/register', 'POST', registration('b@example.com'))).json();
  assert.deepEqual((await (await call('/trips', 'GET', null, b.token)).json()).trips, []);
  assert.equal((await (await call('/trips', 'GET', null, a.token)).json()).trips.length, 1);
  assert.equal((await call('/auth/register', 'POST', registration('A@example.com'))).status, 409);
  assert.equal(db.profiles.size, 2);
  assert.equal((await call('/auth/login', 'POST', { email: 'a@example.com', password: 'wrong-password-123' })).status, 401);
  const login = await call('/auth/login', 'POST', registration('a@example.com'));
  assert.equal(login.status, 200);
  assert.equal((await call('/auth/logout', 'POST', null, a.token)).status, 204);
  assert.equal((await call('/auth/me', 'GET', null, a.token)).status, 401);
  for (const session of db.sessions.values()) session.expiry = new Date(0);
  assert.equal((await call('/auth/me', 'GET', null, b.token)).status, 401);
}));
test('reject invalid inputs and unexpected origins; rate limit auth attempts', async () => withApi(async (call) => {
  assert.equal((await call('/auth/register', 'POST', { ...registration('a@example.com'), password: 'short' })).status, 400);
  assert.equal((await call('/auth/register', 'POST', { ...registration('invalid'), displayName: '' })).status, 400);
  assert.equal((await call('/auth/login', 'POST', {}, null, { Origin: 'https://other.example' })).status, 403);
  let response;
  for (let i = 0; i < 21; i++) response = await call('/auth/login', 'POST', {});
  assert.equal(response.status, 429);
}));
