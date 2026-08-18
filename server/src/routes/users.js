import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword } from '../auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.post('/register', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};

  if (
    !username ||
    !password ||
    !role ||
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    typeof role !== 'string'
  ) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "user"' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const password_hash = hashPassword(password);
  try {
    const info = db
      .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, password_hash, role);

    res.status(201).json({ id: info.lastInsertRowid, username, role });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw err;
  }
});

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});

router.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, role, password } = req.body || {};
  if (username === undefined && role === undefined && password === undefined) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  if (username !== undefined) {
    if (typeof username !== 'string' || !username) {
      return res.status(400).json({ error: 'Username must be a non-empty string' });
    }
    const collision = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username, id);
    if (collision) {
      return res.status(409).json({ error: 'Username already exists' });
    }
  }

  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "user"' });
    }
    if (existing.role === 'admin' && role === 'user') {
      const adminCount = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
        .get().count;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last remaining admin' });
      }
    }
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
  }

  const nextUsername = username !== undefined ? username : existing.username;
  const nextRole = role !== undefined ? role : existing.role;
  const nextPasswordHash = password !== undefined ? hashPassword(password) : existing.password_hash;

  db.prepare('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?').run(
    nextUsername,
    nextRole,
    nextPasswordHash,
    id
  );

  res.json({ id, username: nextUsername, role: nextRole });
});

export default router;
