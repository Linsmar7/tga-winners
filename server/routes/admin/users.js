import express from 'express';
import { getDb } from '../../db.js';
import { hashPassword } from '../../middleware/auth.js';

const router = express.Router();

router.get('/users', (req, res) => {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.created_at,
        (SELECT COUNT(*) FROM voters v WHERE v.user_id = u.id) AS editions_count
       FROM users u
       ORDER BY LOWER(u.username) ASC`
    )
    .all();
  return res.json({ users });
});

router.put('/users/:id/reset-password', (req, res) => {
  const db = getDb();
  const userId = Number(req.params.id);
  const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (newPassword.length < 4 || newPassword.length > 100) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres.' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const hash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

  return res.json({ ok: true, user });
});

router.delete('/voters/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM voters WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }
  return res.json({ ok: true });
});

export default router;
