import mysql from 'mysql2/promise';
import { databaseConfig } from './config.js';
import { createApp } from './app.js';

const db = mysql.createPool({ ...databaseConfig(), connectionLimit: 5 });
const port = Number(process.env.PORT || 3001);
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
const server = createApp(db, { origins, trustProxy: Number(process.env.TRUST_PROXY_HOPS || 0) }).listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Local API: http://127.0.0.1:${port}/api/health`);
});
server.on('error', (error) => {
  console.error(`Server failed: ${error.code}`);
  process.exitCode = 1;
  void db.end();
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(async () => { await db.end(); }));
}
