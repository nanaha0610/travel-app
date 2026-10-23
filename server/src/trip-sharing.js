const validId = value => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value);
export function tripSharingRoutes(app, db, authenticate) {
  app.post('/api/trips/:tripId/visibility', authenticate, async (req, res) => {
    if (!validId(req.params.tripId) || typeof req.body?.isPublic !== 'boolean' || Object.keys(req.body).some(k => k !== 'isPublic')) return res.sendStatus(400);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [trips] = await connection.execute('SELECT id FROM trips WHERE id = ? AND owner_id = ? FOR UPDATE', [req.params.tripId, req.user.id]);
      if (!trips.length) { await connection.rollback(); return res.sendStatus(404); }
      const [clips] = await connection.execute('SELECT id FROM trip_places WHERE trip_id = ? AND EXISTS (SELECT 1 FROM trip_videos WHERE trip_place_id = trip_places.id)', [req.params.tripId]);
      if (req.body.isPublic && !clips.length) { await connection.rollback(); return res.status(400).json({error:'動画を保存してから公開してください。'}); }
      const status = req.body.isPublic ? 'published' : 'draft';
      await connection.execute('UPDATE trips SET status = ? WHERE id = ?', [status, req.params.tripId]);
      if (!req.body.isPublic) await connection.execute('UPDATE video_spots vs JOIN trip_videos v ON v.id = vs.video_id JOIN trip_places p ON p.id = v.trip_place_id SET vs.is_public = FALSE, vs.consent_at = NULL WHERE p.trip_id = ?', [req.params.tripId]);
      await connection.commit(); res.json({status});
    } catch(e) { try { await connection.rollback(); } catch {} throw e; }
    finally { connection.release(); }
  });
  app.get('/api/public/trips', async (req,res) => {
    const before=req.query.before;
    if(before !== undefined && !validId(before))return res.sendStatus(400);
    const [rows]=await db.execute("SELECT t.id, t.title, COUNT(v.id) AS video_count FROM trips t JOIN trip_places p ON p.trip_id = t.id JOIN trip_videos v ON v.trip_place_id = p.id WHERE t.status = 'published'"+(before?' AND t.id < ?':'')+' GROUP BY t.id ORDER BY t.id DESC LIMIT 21', before?[before]:[]);
    const trips=rows.slice(0,20);res.json({trips,nextCursor:rows.length>20?String(trips.at(-1).id):null});
  });
  app.get('/api/public/trips/:tripId/videos', async(req,res)=>{
    if(!validId(req.params.tripId))return res.sendStatus(400);
    const [videos]=await db.execute("SELECT v.id, v.captured_at, p.name AS place_name FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id JOIN trips t ON t.id = p.trip_id WHERE t.id = ? AND t.status = 'published' ORDER BY v.captured_at, v.id LIMIT 20",[req.params.tripId]);
    if(!videos.length)return res.status(404).json({error:'この旅行は公開されていません。'});
    res.json({videos});
  });
  app.get('/api/public/trips/:tripId/videos/:videoId/content', async(req,res)=>{
    if(!validId(req.params.tripId)||!validId(req.params.videoId))return res.sendStatus(400);
    const [rows]=await db.execute("SELECT v.mime_type, v.video_data FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id JOIN trips t ON t.id = p.trip_id WHERE t.id = ? AND v.id = ? AND t.status = 'published'",[req.params.tripId,req.params.videoId]);
    if(!rows.length)return res.status(404).json({error:'動画は非公開になったか、見つかりません。'});
    res.type(rows[0].mime_type).send(rows[0].video_data);
  });
}
