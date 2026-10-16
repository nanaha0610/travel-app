import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, groupVideosByDay } from '../src/pages/dailyRecords.js';

test('day boundaries use device timezone rather than UTC date', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Asia/Tokyo';
  try {
    assert.equal(localDateKey('2026-10-15T14:59:59Z'), '2026-10-15');
    assert.equal(localDateKey('2026-10-15T15:00:00Z'), '2026-10-16');
    assert.equal(localDateKey('invalid'), '');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('daily timeline preserves repeat visits and sorts recordings without mutating input', () => {
  const input = [
    { id: '3', place_name: '京都駅', captured_at: '2026-10-16T18:00:00+09:00' },
    { id: '2', place_name: '清水寺', captured_at: '2026-10-16T12:00:00+09:00' },
    { id: '1', place_name: '京都駅', captured_at: '2026-10-16T10:00:00+09:00' },
    { id: '4', place_name: '翌日の場所', captured_at: '2026-10-17T12:00:00+09:00' },
  ];
  const snapshot = JSON.stringify(input);
  const day = localDateKey(input[0].captured_at);
  const grouped = groupVideosByDay(input);
  assert.deepEqual(grouped.get(day).map(video => video.id), ['1', '2', '3']);
  assert.equal(grouped.size, 2);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(groupVideosByDay([]).size, 0);
});
