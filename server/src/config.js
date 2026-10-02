import { readFileSync } from 'node:fs';
export function databaseConfig() {
  const database = process.env.DB_NAME || 'travel_app_dev';
  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error('DB_NAME must contain only letters, digits, and underscores.');
  }
  const useTLS = process.env.DB_SSL === 'true';
  if (process.env.NODE_ENV === 'production' && !useTLS) throw new Error('Production requires DB_SSL=true');
  return {
    ...(useTLS ? { ssl: { rejectUnauthorized: true, ...(process.env.DB_CA_FILE ? { ca: readFileSync(process.env.DB_CA_FILE, 'utf8') } : {}) } } : {}),
    timezone: 'Z',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 5000,
  };
}
