import { rateLimit } from 'express-rate-limit';
import { searchSpots } from './spot-search.js';
const id = value => typeof value==='string' && /^[1-9][0-9]{0,19}$/.test(value);
export function spotRoutes(app, db, authenticate, search = searchSpots) {
  app.get('/api/spots/search', authenticate, rateLimit({windowMs:60000,limit:10,message:{error:'検索が多すぎます。少し待ってからお試しください。'}}), async(req,res)=>{
    const {q,latitude,longitude}=req.query;
    if(q!==undefined ? typeof q!=='string'||q.trim().length<2||q.length>100 : typeof latitude!=='string'||typeof longitude!=='string'||!latitude.trim()||!longitude.trim()||!Number.isFinite(Number(latitude))||!Number.isFinite(Number(longitude))||Math.abs(Number(latitude))>90||Math.abs(Number(longitude))>180) return res.status(400).json({error:'2〜100文字の場所名、または現在地を指定してください。'});
    let rows;
    try{rows=await search(q!==undefined?{q:q.trim()}:{latitude:Number(latitude),longitude:Number(longitude)});}catch{return res.status(503).json({error:'スポット検索が混み合っています。後で検索するか、紐付けず非公開で保存できます。'});}
    const spots=[];
    for(const row of rows){
      const [result]=await db.execute('INSERT INTO spots (osm_type, osm_id, name, label, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',[row.osm_type,row.osm_id,row.name,row.label,row.latitude,row.longitude]);
      const [saved]=await db.execute('SELECT id, name, label, latitude, longitude, osm_type, osm_id FROM spots WHERE id = ?',[result.insertId]);
      if(saved[0])spots.push(saved[0]);
    }
    res.json({spots});
  });
  app.get('/api/public/spots', async(req,res)=>{
    const [spots]=await db.execute('SELECT s.id, s.name, s.latitude, s.longitude, COUNT(*) AS video_count FROM spots s JOIN video_spots vs ON vs.spot_id = s.id WHERE vs.is_public = TRUE GROUP BY s.id ORDER BY MAX(vs.video_id) DESC LIMIT 100');
    res.json({spots});
  });
  app.get('/api/public/spots/:spotId/videos', async(req,res)=>{
    const before=req.query.before;
    if(!id(req.params.spotId)||(before!==undefined&&!id(before)))return res.sendStatus(400);
    const [rows]=await db.execute('SELECT v.id, v.mime_type FROM trip_videos v JOIN video_spots vs ON vs.video_id = v.id WHERE vs.spot_id = ? AND vs.is_public = TRUE'+(before?' AND v.id < ?':'')+' ORDER BY v.id DESC LIMIT 21',before?[req.params.spotId,before]:[req.params.spotId]);
    const videos=rows.slice(0,20);res.json({videos,nextCursor:rows.length>20?String(videos.at(-1).id):null});
  });
  app.get('/api/public/videos/:videoId/content', async(req,res)=>{
    if(!id(req.params.videoId))return res.sendStatus(400);
    const [rows]=await db.execute('SELECT v.mime_type, v.video_data FROM trip_videos v JOIN video_spots vs ON vs.video_id = v.id WHERE v.id = ? AND vs.is_public = TRUE',[req.params.videoId]);
    if(!rows.length)return res.status(404).json({error:'公開動画が見つかりません。公開が取り消された可能性があります。'});
    res.type(rows[0].mime_type).send(rows[0].video_data);
  });
  app.post('/api/videos/:videoId/visibility', authenticate, async(req,res)=>{
    if(!id(req.params.videoId)||typeof req.body?.isPublic!=='boolean'||Object.keys(req.body).some(key=>key!=='isPublic'))return res.sendStatus(400);
    const [result]=await db.execute('UPDATE video_spots vs JOIN trip_videos v ON v.id = vs.video_id JOIN trip_places p ON p.id = v.trip_place_id JOIN trips t ON t.id = p.trip_id SET vs.is_public = ?, vs.consent_at = ? WHERE vs.video_id = ? AND t.owner_id = ?',[req.body.isPublic,req.body.isPublic?new Date():null,req.params.videoId,req.user.id]);
    if(!result.affectedRows)return res.status(404).json({error:'変更できるスポット付き動画が見つかりません。'});
    res.json({isPublic:req.body.isPublic});
  });
}
