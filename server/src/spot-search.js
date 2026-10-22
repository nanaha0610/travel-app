const cache = new Map();
let busy = false;
let lastRequest = 0;
const headers = { 'User-Agent': 'TravelAppStudentPrototype/0.1 (https://github.com/nanaha0610/travel-app)', 'Accept': 'application/json' };
export function normalizeCandidate(item, overpass = false) {
  const type = overpass ? item.type : item.osm_type;
  const id = String(overpass ? item.id : item.osm_id);
  const rawLat = overpass ? item.lat ?? item.center?.lat : item.lat;
  const rawLng = overpass ? item.lon ?? item.center?.lon : item.lon;
  if (rawLat == null || rawLng == null || rawLat === '' || rawLng === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const name = overpass ? item.tags?.['name:ja'] || item.tags?.name : item.name || item.display_name?.split(',')[0];
  if (!['node','way','relation'].includes(type) || !/^[1-9][0-9]{0,19}$/.test(id) || !name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return null;
  return { osm_type:type, osm_id:id, name:String(name).slice(0,200), label:String(overpass ? name : item.display_name || name).slice(0,500), latitude:lat, longitude:lng };
}
export async function searchSpots({ q, latitude, longitude }) {
  const key=JSON.stringify([q || '',latitude,longitude]);
  const hit=cache.get(key);
  if(hit && hit.until>Date.now())return hit.rows;
  if(busy)throw new Error('SPOT_SEARCH_BUSY');
  busy=true;
  try {
    await new Promise(resolve=>setTimeout(resolve, Math.max(0,1100-(Date.now()-lastRequest))));
    lastRequest=Date.now();
    let response;
    if(q) {
      const params=new URLSearchParams({q,format:'jsonv2',limit:'12','accept-language':'ja'});
      response=await fetch(`${process.env.SPOT_SEARCH_URL || 'https://nominatim.openstreetmap.org/search'}?${params}`,{headers,signal:AbortSignal.timeout(15000)});
    } else {
      const area=`(around:600,${latitude},${longitude})`;
      const query=`[out:json][timeout:12];(nwr[tourism][name]${area};nwr[historic][name]${area};nwr[amenity=place_of_worship][name]${area};nwr[leisure=park][name]${area};);out center 40;`;
      response=await fetch(process.env.SPOT_NEARBY_URL || 'https://overpass-api.de/api/interpreter',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(15000)});
    }
    if(!response.ok)throw new Error('SPOT_SEARCH_UNAVAILABLE');
    const data=await response.json();
    if(data.remark)throw new Error('SPOT_SEARCH_INCOMPLETE');
    let rows=(q ? data : data.elements || []).map(item=>normalizeCandidate(item,!q)).filter(Boolean);
    if(!q)rows.sort((a,b)=>Math.hypot(a.latitude-latitude,(a.longitude-longitude)*Math.cos(latitude*Math.PI/180))-Math.hypot(b.latitude-latitude,(b.longitude-longitude)*Math.cos(latitude*Math.PI/180)));
    rows=[...new Map(rows.map(item=>[`${item.osm_type}/${item.osm_id}`,item])).values()].slice(0,12);
    if(cache.size>=100)cache.delete(cache.keys().next().value);
    cache.set(key,{rows,until:Date.now()+300000});
    return rows;
  }finally{busy=false;}
}
