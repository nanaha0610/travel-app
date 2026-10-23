import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRestaurantsAlongRoute } from '../src/pages/map/restaurantService.js';
test('飲食店検索の範囲・空結果・外部エラーを区別する', async () => {
 const original=globalThis.fetch;
 const path=[[35,139],[35.001,139]];
 try {
  globalThis.fetch=async(_url,options)=>{
   const q=options.body.get('data');
   assert.ok(q.includes('around:300,')); assert.ok(!q.includes('tourism'));
   return {ok:true,json:async()=>({elements:[{type:'node',id:1,lat:35,lon:139,tags:{name:'店',amenity:'restaurant'}},{type:'node',id:2,lat:35,lon:139,tags:{}}]})};
  };
  assert.equal((await fetchRestaurantsAlongRoute(path,110,'foot',300)).length,1);
  globalThis.fetch=async()=>({ok:true,json:async()=>({elements:[],remark:'runtime error: timeout'})});
  await assert.rejects(()=>fetchRestaurantsAlongRoute(path,110,'foot',500),/完了しませんでした/);
  globalThis.fetch=async()=>({ok:true,json:async()=>({elements:[]})});
  assert.deepEqual(await fetchRestaurantsAlongRoute(path,110,'foot',500),[]);
  globalThis.fetch=async()=>({ok:false,status:429});
  await assert.rejects(()=>fetchRestaurantsAlongRoute(path,110,'foot',500),/HTTP 429/);
  await assert.rejects(()=>fetchRestaurantsAlongRoute(path,110,'foot',10000),/検索範囲/);
 } finally {globalThis.fetch=original;}
});
