import crypto from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';

const globals = globalThis as unknown as { posUsersTableEnsured?: boolean };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export async function ensureUsersTable(): Promise<void> {
  if (globals.posUsersTableEnsured) return;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`display_name\` VARCHAR(191) NOT NULL DEFAULT '',
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM `users`');
    const count = Number(rows[0]?.cnt || 0);
    if (count === 0) {
      const defaultPass = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const defaultHash = hashPassword(defaultPass);
      await conn.execute(
        'INSERT INTO `users` (`username`, `display_name`, `role`, `password_hash`, `is_active`) VALUES (?, ?, ?, ?, 1)',
        ['admin', 'Administrator', 'ADMIN', defaultHash]
      );
    }
    globals.posUsersTableEnsured = true;
  } finally {
    await conn.end();
  }
}
