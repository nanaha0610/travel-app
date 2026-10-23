import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRoute,tripDay} from '../src/pages/feed/dayRoute.js';
test('routes use Japan days and collapse only consecutive duplicate stops',()=>{
 const videos=[['運河駅','2026-10-22T15:01:00Z'],['運河駅','2026-10-22T15:02:00Z'],['梅里駅','2026-10-23T01:00:00Z'],['運河駅','2026-10-23T02:00:00Z'],['翌日の場所','2026-10-23T15:00:00Z']].map(([place_name,captured_at])=>({place_name,captured_at}));
 assert.deepEqual(dayRoute(videos,videos[1]),{day:'2026-10-23',places:['運河駅','梅里駅','運河駅']});
 assert.deepEqual(dayRoute(videos,videos[4]).places,['翌日の場所']);
 assert.equal(tripDay('bad date'),'');
});
