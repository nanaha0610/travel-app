import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { databaseConfig } from './config.js';

const { database, ...config } = databaseConfig();
let connection;
try {
  connection = await mysql.createConnection(config);
  if (process.env.DB_CREATE_DATABASE === 'true') {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  }
  await connection.changeUser({ database });
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  console.log(`Database ready: ${database}`);
} catch (error) {
  console.error(`Database initialization failed (${error.code || 'CONFIG_ERROR'}). Check server/.env and MySQL.`);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
