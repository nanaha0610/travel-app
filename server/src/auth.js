import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, salt, hex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  return timingSafeEqual(await derive(password, salt, 64, options), Buffer.from(hex, 'hex'));
}
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export async function issueSession(db, userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 86400000);
  await db.execute('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash(token), userId, expiresAt]);
  return { token, expiresAt: expiresAt.toISOString() };
}
export function requireAuth(db) {
  return async (req, res, next) => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'ログインしてください。' });
    try {
      const [rows] = await db.execute('SELECT u.profile_id AS id, u.email, p.display_name FROM auth_sessions s JOIN auth_users u ON u.profile_id = s.user_id JOIN profiles p ON p.id = u.profile_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()', [tokenHash(token)]);
      if (!rows.length) return res.status(401).json({ error: 'ログインし直してください。' });
      req.user = { ...rows[0], id: String(rows[0].id) };
      req.sessionHash = tokenHash(token);
      next();
    } catch (error) { next(error); }
  };
}
