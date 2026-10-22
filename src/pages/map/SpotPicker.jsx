import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import './SpotPicker.css';
export default function SpotPicker({ location, selected, onSelect, disabled }) {
  const { authRequest } = useAuth();
  const [query,setQuery]=useState('');
  const [spots,setSpots]=useState([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const request=useRef(0);
  useEffect(()=>()=>{request.current++},[]);
  async function search(params) {
    const version=++request.current;setLoading(true);setMessage('');setSpots([]);
    try{
      const data=await authRequest(`/api/spots/search?${new URLSearchParams(params)}`);
      if(version!==request.current)return;
      setSpots(data.spots);if(!data.spots.length)setMessage('候補がありません。別の名前で検索するか、紐付けず保存できます。');
    }catch(e){if(version===request.current)setMessage(e.message)}
    finally{if(version===request.current)setLoading(false)}
  }
  useEffect(()=>{if(location && !selected)void search({latitude:String(location.latitude),longitude:String(location.longitude)})},[location]);
  return <section className="spot-picker" aria-label="動画のスポットを選ぶ"><h3>この動画はどこで撮りましたか？</h3>
    <p>近くの候補を確認して選んでください。自動では確定しません。</p>
    <form onSubmit={e=>{e.preventDefault();void search({q:query.trim()})}}><label>場所名で検索<input value={query} onChange={e=>setQuery(e.target.value)} minLength={2} maxLength={100} required placeholder="例：清水寺 京都" disabled={disabled}/></label><button disabled={disabled||loading||query.trim().length<2}>検索</button></form>
    {location && <button type="button" disabled={disabled||loading} onClick={()=>search({latitude:String(location.latitude),longitude:String(location.longitude)})}>近くの候補を再検索</button>}
    {loading && <p role="status">近くのスポットを検索しています…</p>}{message && <p role="status">{message}</p>}
    <div className="spot-candidates">{spots.map(spot=><button type="button" disabled={disabled} aria-pressed={String(selected?.id)===String(spot.id)} key={spot.id} onClick={()=>onSelect(spot)}><strong>{spot.name}</strong><small>{spot.label}</small></button>)}</div>
    {selected && <p>選択中：<strong>{selected.name}</strong> <button type="button" disabled={disabled} onClick={()=>onSelect(null)}>紐付けを外す</button></p>}
    <p className="status-note">検索語または現在地をサーバー経由で地図サービスに送ります。候補には誤りや同名の場所があるため、地名を確認してください。データ：© OpenStreetMap contributors（ODbL）、検索：Nominatim / Overpass API。</p>
  </section>;
}
