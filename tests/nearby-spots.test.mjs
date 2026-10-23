import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySpot, fetchRestaurantsAlongRoute } from '../src/pages/map/restaurantService.js';
test('スポットを種類別に分類する', () => {
  for (const [tags, category] of [[{amenity:'cafe'},'food'],[{amenity:'place_of_worship'},'tourism'],[{tourism:'museum'},'tourism'],[{leisure:'park'},'nature'],[{shop:'convenience'},'shopping']]) assert.equal(classifySpot(tags).category,category);
});
test('各種スポットを検索し名前や位置がない結果を除外する', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const query = options.body.get('data');
    for(const key of ['tourism','historic','leisure','natural','shop','place_of_worship']) assert.ok(query.includes(key));
    return {ok:true,json:async()=>({elements:[{type:'node',id:1,lat:35,lon:139,tags:{name:'公園',leisure:'park'}},{type:'node',id:2,lat:35,lon:139,tags:{}}]})};
  };
  try {
    const result = await fetchRestaurantsAlongRoute([[35,139],[35.001,139]],100,'foot');
    assert.equal(result.length,1);
    assert.equal(result[0].category,'nature');
  } finally {globalThis.fetch=original;}
});
