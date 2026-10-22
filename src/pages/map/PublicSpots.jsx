import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { apiRequest, isApiConfigured } from '../../api/client.js';
import './RecordedPlaces.css';
function PublicClip({ video, name }) {
  const [url,setUrl]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [retry,setRetry]=useState(0);const [opened,setOpened]=useState(false);
  useEffect(()=>{
    if(!opened)return;
    let active=true,objectUrl='';setLoading(true);setError('');setUrl('');
    apiRequest(`/api/public/videos/${video.id}/content`,{responseType:'blob'}).then(blob=>{if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[video.id,opened,retry]);
  return <article className="trip-video-card"><strong>{name}</strong>{url?<video src={url} controls playsInline aria-label={`${name}の公開動画`} onError={()=>setError('この動画を再生できません。')}/>:<button disabled={loading} onClick={()=>{setOpened(true);setRetry(n=>n+1)}}>{loading?'読込中…':'▶ 公開動画を読み込む'}</button>}{error && <p role="alert">{error}</p>}</article>;
}
function PublicClips({ spot }) {
  const [videos,setVideos]=useState([]);const [cursor,setCursor]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [reload,setReload]=useState(0);const generation=useRef(0);const pending=useRef(false);
  useEffect(()=>{
    const version=++generation.current;setVideos([]);setError('');setLoading(true);setCursor(null);pending.current=true;
    apiRequest(`/api/public/spots/${spot.id}/videos`).then(data=>{if(version===generation.current){setVideos(data.videos);setCursor(data.nextCursor)}}).catch(e=>{if(version===generation.current)setError(e.message)}).finally(()=>{if(version===generation.current){setLoading(false);pending.current=false}});
    return()=>{generation.current++};
  },[spot.id,reload]);
  async function more(){
    if(pending.current||!cursor)return;pending.current=true;setLoading(true);setError('');const version=generation.current;
    try{const data=await apiRequest(`/api/public/spots/${spot.id}/videos?before=${cursor}`);if(version===generation.current){setVideos(current=>[...current,...data.videos.filter(v=>!current.some(c=>String(c.id)===String(v.id)))]);setCursor(data.nextCursor)}}catch(e){if(version===generation.current)setError(e.message)}finally{if(version===generation.current){pending.current=false;setLoading(false)}}
  }
  return <><h3>{spot.name}の公開動画</h3><button disabled={loading} onClick={()=>setReload(n=>n+1)}>動画を更新</button>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">読込中…</p>}{!loading&&!error&&!videos.length&&<p>現在公開されている動画はありません。</p>}<div className="trip-video-list">{videos.map(video=><PublicClip key={video.id} video={video} name={spot.name}/>)}</div>{cursor&&<button disabled={loading} onClick={more}>さらに読み込む</button>}</>;
}
export default function PublicSpots({ map }) {
  const [spots,setSpots]=useState([]);const [selected,setSelected]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(!isApiConfigured){setLoading(false);return;}
    let active=true;setLoading(true);setError('');setSelected(null);setSpots([]);
    apiRequest('/api/public/spots').then(data=>{if(active)setSpots(data.spots)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[reload]);
  useEffect(()=>{
    if(!map)return;
    const layer=L.layerGroup().addTo(map);const icon=L.divIcon({className:'public-spot-pin',html:'<span aria-hidden="true">▶</span>',iconSize:[36,36],iconAnchor:[18,18]});
    for(const spot of spots){const lat=Number(spot.latitude),lng=Number(spot.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;const label=document.createElement('span');label.textContent=`${spot.name} · 公開動画 ${spot.video_count}本`;L.marker([lat,lng],{icon,title:`${spot.name}の公開動画`,alt:`${spot.name}の公開動画`}).bindTooltip(label).on('click',()=>setSelected(spot)).addTo(layer)}
    return()=>{layer.clearLayers();layer.remove()};
  },[map,spots]);
  if(!isApiConfigured)return null;
  return <section className="recorded-places" aria-label="スポットの公開動画"><h2>みんなのスポット動画</h2><p>オレンジの▶ピンには、撮影者が公開を許可した動画があります。</p><button disabled={loading} onClick={()=>setReload(n=>n+1)}>公開スポットを更新</button>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">読込中…</p>}{!loading&&!error&&!spots.length&&<p>公開動画のあるスポットはまだありません。</p>}<div className="recorded-place-list">{spots.map(spot=><button key={spot.id} aria-pressed={String(selected?.id)===String(spot.id)} onClick={()=>{setSelected(spot);map?.setView([Number(spot.latitude),Number(spot.longitude)],16)}}>{spot.name} · {spot.video_count}本</button>)}</div>{selected&&<div className="recorded-place-detail"><button onClick={()=>setSelected(null)}>閉じる</button><PublicClips key={selected.id} spot={selected}/></div>}<p className="recorded-note">公開動画のあるスポットを新しい動画順に最大100件表示。旅行名・アカウント名・正確な撮影日時は公開しません。スポットデータ © OpenStreetMap contributors（ODbL）。</p></section>;
}
