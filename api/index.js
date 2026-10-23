import mysql from 'mysql2/promise';
import { databaseConfig } from '../server/src/config.js';
import { createApp } from '../server/src/app.js';
const db = mysql.createPool({ ...databaseConfig(), connectionLimit: 2, maxIdle: 1, idleTimeout: 10000 });
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
  if (host) origins.push(`https://${host}`);
}
export default createApp(db, { origins, trustProxy: 1 });
