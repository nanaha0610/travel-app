import express from 'express';

export const MAX_VIDEO_BYTES = 2 * 1024 * 1024;
export function validVideo(buffer, type) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_VIDEO_BYTES) return false;
  return type === 'video/webm' ? buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : type === 'video/mp4' && buffer.subarray(4, 8).toString() === 'ftyp';
}
const validId = value => /^[1-9][0-9]{0,19}$/.test(value);

export function videoRoutes(app, db, authenticate) {
  app.get('/api/trips/:tripId/videos', authenticate, async (req, res) => {
    if (!validId(req.params.tripId)) return res.sendStatus(400);
    const [trips] = await db.execute('SELECT id FROM trips WHERE id = ? AND owner_id = ?', [req.params.tripId, req.user.id]);
    if (!trips.length) return res.status(404).json({ error: '旅行が見つかりません。' });
    const [videos] = await db.execute('SELECT v.id, v.captured_at, v.byte_size, v.mime_type, p.name AS place_name FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id WHERE p.trip_id = ? ORDER BY v.captured_at, v.id LIMIT 20', [req.params.tripId]);
    res.json({ videos });
  });
  app.post('/api/trips/:tripId/videos', authenticate, express.raw({ type: ['video/webm', 'video/mp4'], limit: MAX_VIDEO_BYTES }), async (req, res) => {
    const type = (req.headers['content-type'] || '').split(';')[0];
    const { uploadId, place = '場所未設定', capturedAt } = req.query;
    if (!validId(req.params.tripId) || typeof uploadId !== 'string' || !/^[a-f0-9-]{36}$/.test(uploadId)
      || typeof place !== 'string' || !place.trim() || [...place.trim()].length > 100
      || typeof capturedAt !== 'string' || !Number.isFinite(Date.parse(capturedAt))
      || Date.parse(capturedAt) > Date.now() + 300000 || !validVideo(req.body, type)) {
      return res.status(400).json({ error: '動画形式・サイズ（2MB以内）・撮影日時・場所名を確認してください。' });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the parent trip so concurrent saves cannot exceed the limit.
      const [trips] = await connection.execute('SELECT id FROM trips WHERE id = ? AND owner_id = ? FOR UPDATE', [req.params.tripId, req.user.id]);
      if (!trips.length) { await connection.rollback(); return res.status(404).json({ error: '旅行が見つかりません。' }); }
      const [existing] = await connection.execute('SELECT v.id FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id WHERE p.trip_id = ? AND v.upload_id = ?', [req.params.tripId, uploadId]);
      if (existing.length) { await connection.commit(); return res.json({ id: String(existing[0].id) }); }
      const [counts] = await connection.execute('SELECT COUNT(*) AS count FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id WHERE p.trip_id = ?', [req.params.tripId]);
      if (Number(counts[0].count) >= 20) { await connection.rollback(); return res.status(409).json({ error: 'この旅行は20本の保存上限に達しています。' }); }
      const [places] = await connection.execute('SELECT id FROM trip_places WHERE trip_id = ? AND name = ?', [req.params.tripId, place.trim()]);
      let placeId = places[0]?.id;
      if (!placeId) {
        const [result] = await connection.execute('INSERT INTO trip_places (trip_id, name) VALUES (?, ?)', [req.params.tripId, place.trim()]);
        placeId = result.insertId;
      }
      const [result] = await connection.execute('INSERT INTO trip_videos (trip_place_id, upload_id, captured_at, mime_type, byte_size, video_data) VALUES (?, ?, ?, ?, ?, ?)', [placeId, uploadId, new Date(capturedAt), type, req.body.length, req.body]);
      await connection.commit();
      res.status(201).json({ id: String(result.insertId) });
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  });
  app.get('/api/videos/:videoId/content', authenticate, async (req, res) => {
    if (!validId(req.params.videoId)) return res.sendStatus(400);
    const [rows] = await db.execute('SELECT v.mime_type, v.video_data FROM trip_videos v JOIN trip_places p ON p.id = v.trip_place_id JOIN trips t ON t.id = p.trip_id WHERE v.id = ? AND t.owner_id = ?', [req.params.videoId, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: '動画が見つかりません。' });
    res.type(rows[0].mime_type).send(rows[0].video_data);
  });
}
