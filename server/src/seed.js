import 'dotenv/config';
import { db } from './db.js';
import { hashPassword } from './auth.js';

const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASS || 'changeme123';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  console.log(`User "${username}" already exists, skipping seed.`);
} else {
  const password_hash = hashPassword(password);
  db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, password_hash, 'admin');
  console.log(`Seeded admin user "${username}".`);
}
