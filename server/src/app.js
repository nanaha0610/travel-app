import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, issueSession, requireAuth } from './auth.js';

const credentials = (body) => body && typeof body.email === 'string'
  && body.email.trim().length <= 254 && /^[\x21-\x7e]+$/.test(body.email.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  && typeof body.password === 'string' && body.password.length >= 12 && body.password.length <= 128;

export function createApp(db, { origins = [], trustProxy = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!origins.includes(origin)) return res.status(403).json({ error: '許可されていない接続元です。' });
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  const limiter = rateLimit({ windowMs: 900000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '時間をおいて再試行してください。' } });
  app.use('/api/auth/register', limiter);
  app.use('/api/auth/login', limiter);
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', async (_req, res) => { await db.execute('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); });

  app.post('/api/auth/register', async (req, res, next) => {
    const body = req.body;
    if (!credentials(body) || typeof body.displayName !== 'string' || !body.displayName.trim() || [...body.displayName.trim()].length > 100
      || Object.keys(body).some((key) => !['email', 'password', 'displayName'].includes(key))) {
      return res.status(400).json({ error: 'メール、12〜128文字のパスワード、1〜100文字の表示名を入力してください。' });
    }
    const email = body.email.trim().toLowerCase();
    const displayName = body.displayName.trim();
    const passwordHash = await hashPassword(body.password);
    // Random 48-bit profile ID avoids claiming the old fixed development user.
    const id = String(randomBytes(6).readUIntBE(0, 6) + 2);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('INSERT INTO profiles (id, display_name) VALUES (?, ?)', [id, displayName]);
      await connection.execute('INSERT INTO auth_users (profile_id, email, password_hash) VALUES (?, ?, ?)', [id, email, passwordHash]);
      const session = await issueSession(connection, id);
      await connection.commit();
      res.status(201).json({ user: { id, email, display_name: displayName }, ...session });
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '登録できませんでした。既存アカウントでのログインを確認してください。' });
      next(error);
    } finally { connection.release(); }
  });
  app.post('/api/auth/login', async (req, res) => {
    if (!credentials(req.body)) return res.status(400).json({ error: 'メールと12〜128文字のパスワードを入力してください。' });
    const [rows] = await db.execute('SELECT u.profile_id, u.email, u.password_hash, p.display_name FROM auth_users u JOIN profiles p ON p.id = u.profile_id WHERE u.email = ?', [req.body.email.trim().toLowerCase()]);
    const encoded = rows[0]?.password_hash || `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const valid = await verifyPassword(req.body.password, encoded);
    if (!rows.length || !valid) return res.status(401).json({ error: 'メールまたはパスワードが違います。' });
    const { profile_id, email, display_name } = rows[0];
    res.json({ user: { id: String(profile_id), email, display_name }, ...await issueSession(db, profile_id) });
  });
  const authenticate = requireAuth(db);
  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/logout', authenticate, async (req, res) => {
    await db.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [req.sessionHash]);
    res.sendStatus(204);
  });
  app.get('/api/trips', authenticate, async (req, res) => {
    const [rows] = await db.execute('SELECT id, owner_id, title, status, created_at, updated_at FROM trips WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [req.user.id]);
    res.json({ trips: rows });
  });
  app.post('/api/trips', authenticate, async (req, res) => {
    const body = req.body;
    if (!body || typeof body.title !== 'string' || !body.title.trim() || [...body.title.trim()].length > 100 || Object.keys(body).some((key) => key !== 'title')) return res.status(400).json({ error: 'title だけを指定し、1〜100文字で入力してください。' });
    const [result] = await db.execute('INSERT INTO trips (owner_id, title) VALUES (?, ?)', [req.user.id, body.title.trim()]);
    res.status(201).json({ trip: { id: String(result.insertId), owner_id: req.user.id, title: body.title.trim(), status: 'draft' } });
  });
  app.use((_req, res) => res.status(404).json({ error: 'API が見つかりません。' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON の形式を確認してください。' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '送信データが大きすぎます。' });
    console.error(`API failure: ${error.code || 'UNKNOWN'}`);
    res.status(503).json({ error: 'サーバー処理に失敗しました。' });
  });
  return app;
}
