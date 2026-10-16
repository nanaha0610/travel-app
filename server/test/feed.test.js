import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { videoRoutes } from '../src/videos.js';

async function fixture(run) {
  const rows = Array.from({ length: 25 }, (_, index) => ({
    id: String(index + 1), owner: 'alice', trip_id: String(index % 2 + 1),
    trip_title: index % 2 ? '京都旅行' : '東京旅行', place_name: '撮影場所',
    captured_at: '2026-10-16T00:00:00.000Z', mime_type: 'video/webm', byte_size: 100,
  }));
  rows.push({ ...rows[0], id: '999', owner: 'bob', trip_title: '他の人の旅行' });
  let queries = 0;
  const db = { async execute(sql, args) {
    queries++;
    assert.match(sql, /WHERE t\.owner_id = \?/);
    assert.match(sql, /ORDER BY v\.id DESC LIMIT 21$/);
    assert.doesNotMatch(sql, /video_data|SELECT \*/);
    if (args.length === 2) assert.match(sql, /AND v\.id < \?/);
    return [rows.filter(row => row.owner === args[0] && (!args[1] || BigInt(row.id) < BigInt(args[1])))
      .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? 1 : -1).slice(0, 21)
      .map(({ owner, ...video }) => video)];
  } };
  const app = express();
  videoRoutes(app, db, (req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.user = { id: req.headers.authorization }; next();
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (query = '', owner = 'alice') => fetch(`http://127.0.0.1:${server.address().port}/api/videos${query}`,
    { headers: owner ? { Authorization: owner } : {} });
  try { await run({ request, rows, queryCount: () => queries }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('feed lists only own metadata, paginates across trips, and keeps new inserts out of continuation', async () => fixture(async ({ request, rows }) => {
  const first = await (await request()).json();
  assert.equal(first.videos.length, 20);
  assert.equal(first.videos[0].id, '25');
  assert.equal(first.nextCursor, '6');
  assert.equal(new Set(first.videos.map(video => video.trip_id)).size, 2);
  assert.ok(first.videos.every(video => video.id !== '999' && !('video_data' in video)));
  rows.push({ ...rows[0], id: '26' });
  const second = await (await request(`?before=${first.nextCursor}`)).json();
  assert.deepEqual(second.videos.map(video => video.id), ['5', '4', '3', '2', '1']);
  assert.equal(second.nextCursor, null);
  assert.equal((await (await request('', 'bob')).json()).videos[0].id, '999');
  assert.deepEqual(await (await request('', 'nobody')).json(), { videos: [], nextCursor: null });
}));

test('feed rejects unauthenticated and malformed cursor requests before querying', async () => fixture(async ({ request, queryCount }) => {
  assert.equal((await request('', '')).status, 401);
  for (const query of ['?before=', '?before=-1', '?before=abc', '?before=1&before=2', '?before=999999999999999999999']) {
    assert.equal((await request(query)).status, 400);
  }
  assert.equal(queryCount(), 0);
}));
