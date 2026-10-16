import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Substitute Vite's build-time environment for this Node-only transport test.
const source = (await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://api.example.test'));
const { apiRequest } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('JSON profile requests and binary video requests share the authenticated client', async (t) => {
  const calls = [];
  const responses = [
    Response.json({ trips: [{ id: '1', title: '京都旅行' }] }),
    Response.json({ id: '2' }, { status: 201 }),
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'video/webm' } }),
    Response.json({ error: 'ログインし直してください。' }, { status: 401 }),
  ];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    return responses.shift();
  });
  const token = 'test-only-token';
  const trips = await apiRequest('/api/trips', { token });
  assert.equal(trips.trips[0].title, '京都旅行');
  const video = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/webm' });
  await apiRequest('/api/trips/1/videos', { method: 'POST', token, rawBody: video, contentType: 'video/webm' });
  assert.equal(calls[1].body, video); // Do not JSON-encode the video.
  assert.equal(calls[1].headers['Content-Type'], 'video/webm');
  assert.equal(calls[1].headers.Authorization, `Bearer ${token}`);
  const downloaded = await apiRequest('/api/videos/2/content', { token, responseType: 'blob' });
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), new Uint8Array([1, 2, 3]));
  await assert.rejects(apiRequest('/api/videos/2/content', { token, responseType: 'blob' }),
    error => error.status === 401 && error.message === 'ログインし直してください。');
  assert.equal(calls[0].url, 'https://api.example.test/api/trips');
});
