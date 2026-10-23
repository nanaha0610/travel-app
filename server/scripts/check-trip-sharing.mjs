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
  const [spotResult] = await connection.execute("INSERT INTO spots (osm_type,osm_id,name,label,latitude,longitude) VALUES ('node',?,?,?,?,?)", [String(Date.now()), '検証スポット', '検証専用', 35, 135]);
  const spotId=String(spotResult.insertId);
  query.set('uploadId',randomUUID()); query.set('spotId',spotId); query.set('publish','false');
  response=await upload(); assert.equal(response.status,201); const privateId=(await response.json()).id;
  assert.equal((await fetch(`${base}/public/videos/${privateId}/content`)).status,404);
  query.set('publish','true'); assert.equal((await upload()).status,200);
  assert.equal((await fetch(`${base}/public/videos/${privateId}/content`)).status,404);
  query.set('uploadId',randomUUID()); response=await upload(); assert.equal(response.status,201); const publicId=(await response.json()).id;
  assert.equal((await fetch(`${base}/public/videos/${publicId}/content`)).status,200);
  let data=await (await fetch(`${base}/public/spots/${spotId}/videos`)).json(); assert.equal(data.videos.length,1); assert.equal(String(data.videos[0].id),String(publicId));
  assert.deepEqual(Object.keys(data.videos[0]).sort(),['id','mime_type']);
  const ownerToken=token;
  response=await call('/auth/register',{email:`${randomUUID()}@example.invalid`,password:randomUUID(),displayName:'他ユーザー'}); assert.equal(response.status,201); token=(await response.json()).token;
  assert.equal((await call(`/videos/${publicId}/visibility`,{isPublic:false})).status,404);
  token=ownerToken;
  assert.equal((await call(`/videos/${publicId}/visibility`,{isPublic:false})).status,200);
  assert.equal((await fetch(`${base}/public/videos/${publicId}/content`)).status,404);
  data=await (await fetch(`${base}/public/spots/${spotId}/videos`)).json(); assert.equal(data.videos.length,0);
  assert.equal((await call(`/videos/${privateId}/visibility`,{isPublic:'true'})).status,400);
  query.set('uploadId',randomUUID()); query.set('spotId','999999999999999999'); assert.equal((await upload()).status,400);
  data=await (await call(`/trips/${tripId}/videos`)).json(); assert.equal(data.videos.length,3);
  assert.equal((await fetch(`${base}/public/trips/${tripId}/videos`)).status,404);
  assert.equal((await call(`/trips/${tripId}/visibility`,{isPublic:'true'})).status,400);
  assert.equal((await call(`/trips/${tripId}/visibility`,{isPublic:true})).status,200);
  data=await (await fetch(`${base}/public/trips/${tripId}/videos`)).json();assert.equal(data.videos.length,3);
  assert.ok(!('latitude' in data.videos[0]));
  assert.equal((await fetch(`${base}/public/trips/${tripId}/videos/${privateId}/content`)).status,200);
  const listResponse=await (await fetch(`${base}/public/trips`)).json();assert.ok(listResponse.trips.some(t=>String(t.id)===String(tripId)));
  assert.equal((await call(`/videos/${publicId}/visibility`,{isPublic:true})).status,200);
  assert.equal((await call(`/trips/${tripId}/visibility`,{isPublic:false})).status,200);
  assert.equal((await fetch(`${base}/public/trips/${tripId}/videos/${privateId}/content`)).status,404);
  assert.equal((await fetch(`${base}/public/videos/${publicId}/content`)).status,404);
  assert.equal((await call(`/trips/${tripId}/visibility`,{isPublic:true})).status,200);
  query.set('uploadId',randomUUID());query.delete('spotId');query.delete('publish');assert.equal((await upload()).status,201);
  assert.equal((await fetch(`${base}/public/trips/${tripId}/videos`)).status,404);
  response=await call('/auth/register',{email:`${randomUUID()}@example.invalid`,password:randomUUID(),displayName:'第三者'});token=(await response.json()).token;
  assert.equal((await call(`/trips/${tripId}/visibility`,{isPublic:true})).status,404);
  token=ownerToken;
  assert.equal((await call(`/trips/${tripId}/videos`)).status,200);
  console.log('TRIP_PUBLIC_FEED_PRIVATE_REVOKE_NEW_CLIP_OWNERSHIP_OK');
  console.log('SPOT_PRIVACY_PUBLICATION_REVOCATION_OWNERSHIP_RETRY_ROLLBACK_OK');
  console.log('AIVEN_VIDEO_API_INTEGRATION_OK');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await connection.rollback();
  await connection.end();
  console.log('TEST_ROWS_ROLLED_BACK');
}
