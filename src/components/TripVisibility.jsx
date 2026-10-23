import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
export default function TripVisibility({ trip, onChanged, disabled = false }) {
  const { authRequest } = useAuth();
  const [consent,setConsent]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const published=trip.status==='published';
  async function change(isPublic){
    if(pending||disabled||(isPublic&&!consent))return;
    setPending(true);setError('');
    try{const data=await authRequest(`/api/trips/${trip.id}/visibility`,{method:'POST',body:{isPublic}});setConsent(false);onChanged(data.status);}catch(e){setError(e.message)}finally{setPending(false)}
  }
  return <section className="trip-visibility" aria-label="旅行の公開設定">
    <h3>この旅行の公開設定</h3><p>{published?'全体に公開中：動画一覧から誰でも見られます。':'自分だけ：旅行の動画一覧は本人のプロフィールから見られます。'}</p>
    {!published&&<label><input type="checkbox" checked={consent} disabled={pending||disabled} onChange={e=>setConsent(e.target.checked)}/>この旅行名・保存済みの全動画・訪問場所と撮影日時を、世界中の人が閲覧・保存できることを許可する</label>}
    <div><button disabled={pending||disabled||(!published&&!consent)} onClick={()=>change(!published)}>{pending?'変更中…':published?'自分だけに戻す':'許可して旅行を公開する'}</button>
    {!published&&<button disabled={pending||disabled} onClick={()=>change(false)}>自分だけにする（スポット公開も解除）</button>}</div>
    <p className="status-note">動画一覧では短い動画を撮影順に再生します。新しい動画を追加すると旅行は非公開に戻り、再度許可が必要です。個別のスポット公開は別設定ですが、「自分だけにする」で一緒に解除できます。ダウンロード済みのコピーは回収できません。</p>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
