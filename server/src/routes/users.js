import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword } from '../auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.post('/register', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "user"' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const password_hash = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, password_hash, role);

  res.status(201).json({ id: info.lastInsertRowid, username, role });
});

export default router;
