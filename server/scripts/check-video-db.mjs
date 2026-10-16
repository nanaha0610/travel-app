// Transaction-isolated integration check: all generated rows are rolled back.
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { databaseConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
const connection = await mysql.createConnection(databaseConfig());
const db = {
  execute: (...args) => connection.execute(...args),
  getConnection: async () => ({
    execute: (...args) => connection.execute(...args),
    beginTransaction: () => connection.query('SAVEPOINT api_test'),
    commit: () => connection.query('RELEASE SAVEPOINT api_test'),
    rollback: () => connection.query('ROLLBACK TO SAVEPOINT api_test'),
    release() {},
  }),
};
let server;
try {
  await connection.beginTransaction();
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token;
  const call = (path, body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let response = await call('/auth/register', { email: `${randomUUID()}@example.invalid`, password: randomUUID(), displayName: '一時検証' });
  assert.equal(response.status, 201); token = (await response.json()).token;
  response = await call('/trips', { title: '一時検証旅行' }); assert.equal(response.status, 201);
  const tripId = (await response.json()).trip.id;
  const query = new URLSearchParams({ uploadId: randomUUID(), capturedAt: new Date().toISOString(), place: '一時検証場所' });
  const bytes = Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0]);
  const upload = () => fetch(`${base}/trips/${tripId}/videos?${query}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/webm' }, body: bytes });
  response = await upload(); assert.equal(response.status, 201); const videoId = (await response.json()).id;
  assert.equal((await upload()).status, 200);
  response = await call(`/trips/${tripId}/videos`); assert.equal(response.status, 200);
  const list = await response.json(); assert.equal(list.videos.length, 1); assert.equal(list.videos[0].place_name, '一時検証場所');
  response = await call(`/videos/${videoId}/content`); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal((await fetch(`${base}/videos/${videoId}/content`)).status, 401);
  console.log('AIVEN_VIDEO_API_INTEGRATION_OK');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await connection.rollback();
  await connection.end();
  console.log('TEST_ROWS_ROLLED_BACK');
}
