import test from 'node:test';
import assert from 'node:assert/strict';
import {groupRecordingPlaces} from '../src/pages/map/recordingPlaces.js';

test('recordings group by location without treating missing coordinates as zero',()=>{
 const groups=groupRecordingPlaces([
 {id:1,place_name:'海',latitude:'0.0000000',longitude:'0.0000000'},
 {id:2,place_name:'海',latitude:0,longitude:0},
 {id:3,place_name:'海',latitude:null,longitude:null},
 {id:4,place_name:'海',latitude:35,longitude:135},
 {id:5,place_name:'不正',latitude:91,longitude:135},
 ]);
 assert.equal(groups.length,4);
 assert.deepEqual(groups[0].videos.map(v=>v.id),[1,2]);
 assert.equal(groups[0].located,true);
 assert.equal(groups[1].located,false);
 assert.equal(groups[2].located,true);
 assert.equal(groups[3].located,false);
});
