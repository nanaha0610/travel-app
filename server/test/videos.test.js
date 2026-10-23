import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { videoRoutes, MAX_VIDEO_BYTES } from '../src/videos.js';

const video = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
async function fixture(run) {
  const state = { count: 0, saved: new Map(), inserts: 0, failInsert: false, rollbacks: 0, locations: [], visibilityResets: 0 };
  const db = {
    getConnection: async () => db, beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => { state.rollbacks++; }, release() {},
    async execute(sql, args) {
      if (sql.startsWith('SELECT id FROM trips')) return [args[0] === '1' && args[1] === 'owner' ? [{ id: 1 }] : []];
      if (sql.startsWith("UPDATE trips SET status = 'draft'")) { state.visibilityResets++; return [{affectedRows:1}]; }
      if (sql.startsWith('SELECT COUNT')) return [[{ count: state.count }]];
      if (sql.startsWith('SELECT v.id FROM')) return [state.saved.has(args[1]) ? [{ id: state.saved.get(args[1]) }] : []];
      if (sql.startsWith('SELECT id FROM trip_places')) return [[{ id: 10 }]];
      if (sql.startsWith('UPDATE trip_places')) { state.locations.push(args); return [{ affectedRows: 1 }]; }
      if (sql.startsWith('INSERT INTO trip_videos')) {
        if (state.failInsert) throw new Error('simulated database failure');
        state.inserts++; state.count++; state.saved.set(args[1], state.count); return [{ insertId: state.count }];
      }
      if (sql.startsWith('SELECT v.id,')) return [[{ id: 1, place_name: '京都' }]];
      if (sql.startsWith('SELECT v.mime_type')) return [args[1] === 'owner' ? [{ mime_type: 'video/webm', video_data: video }] : []];
      throw new Error('Unexpected SQL');
    },
  };
  const app = express();
  const auth = (req, res, next) => { if (!req.headers.authorization) return res.sendStatus(401); req.user = { id: req.headers.authorization }; next(); };
  videoRoutes(app, db, auth);
  app.use((error, req, res, next) => res.sendStatus(error.type === 'entity.too.large' ? 413 : 503));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const upload = (overrides = {}) => {
    const params = new URLSearchParams({ uploadId: overrides.id || randomUUID(), capturedAt: new Date().toISOString(), place: '京都' });
    if (overrides.location) for (const [key, value] of Object.entries(overrides.location)) params.set(key, value);
    return fetch(`${base}/trips/${overrides.trip || '1'}/videos?${params}`, { method: 'POST', headers: { Authorization: overrides.owner || 'owner', 'Content-Type': overrides.type || 'video/webm' }, body: overrides.body || video });
  };
  try { await run({ upload, state, base }); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('video ownership, save, idempotent retries and 20-video limit', async () => fixture(async ({ upload, state, base }) => {
  assert.equal((await fetch(`${base}/trips/1/videos`)).status, 401);
  assert.equal((await upload({ owner: 'other' })).status, 404);
  assert.equal(state.inserts, 0);
  const id = randomUUID();
  assert.equal((await upload({ id })).status, 201);
  assert.equal((await upload({ id })).status, 200);
  assert.equal(state.inserts, 1);
  assert.equal(state.visibilityResets, 1);
  const own = await fetch(`${base}/videos/1/content`, { headers: { Authorization: 'owner' } });
  assert.equal(own.status, 200);
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), video);
  assert.equal((await fetch(`${base}/videos/1/content`, { headers: { Authorization: 'other' } })).status, 404);
  assert.equal((await fetch(`${base}/trips/1/videos`, { headers: { Authorization: 'other' } })).status, 404);
  state.count = 20;
  assert.equal((await upload()).status, 409);
  assert.equal((await upload({ id })).status, 200);
}));
test('video rejects oversized/invalid uploads and rolls back failed saves', async () => fixture(async ({ upload, state }) => {
  assert.equal((await upload({ body: Buffer.alloc(MAX_VIDEO_BYTES + 1) })).status, 413);
  assert.equal((await upload({ body: Buffer.from('not a video') })).status, 400);
  assert.equal((await upload({ type: 'text/html' })).status, 400);
  assert.equal(state.inserts, 0);
  state.failInsert = true;
  assert.equal((await upload()).status, 503);
  assert.equal(state.rollbacks, 1);
}));

test('coordinates validate as a pair and are saved only after ownership and deduplication', async () => fixture(async ({ upload, state }) => {
  for (const location of [{latitude:'91', longitude:'135'}, {latitude:'35'}, {latitude:'',longitude:'0'}, {latitude:'NaN',longitude:'0'}, {latitude:'0',longitude:'181'}]) {
    assert.equal((await upload({location})).status,400);
  }
  assert.equal(state.inserts,0);
  const location={latitude:'35.01',longitude:'135.76'};
  assert.equal((await upload({owner:'other',location})).status,404);
  assert.equal(state.locations.length,0);
  const id=randomUUID();
  assert.equal((await upload({id,location})).status,201);
  assert.deepEqual(state.locations,[[35.01,135.76,10]]);
  assert.equal((await upload({id,location})).status,200);
  assert.equal(state.locations.length,1);
}));
