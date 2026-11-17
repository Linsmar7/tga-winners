import express from 'express';
import { getDb } from '../db.js';
import {
  hashPassword,
  readUserFromReq,
  signUserToken,
  verifyPassword,
} from '../middleware/auth.js';

const router = express.Router();

function setUserCookie(res, token) {
  res.cookie('user_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * Vincula palpites antigos (criados antes do sistema de login, com user_id NULL)
 * que tenham o mesmo apelido do usuário recém-cadastrado ou logado.
 */
function claimLegacyVoters(db, user) {
  const legacyRows = db
    .prepare(
      `SELECT id, edition_id FROM voters
       WHERE user_id IS NULL AND LOWER(TRIM(nickname)) = LOWER(?)
       ORDER BY updated_at DESC, id DESC`
    )
    .all(user.username);

  if (legacyRows.length === 0) return;

  const hasForEdition = db.prepare(
    'SELECT id FROM voters WHERE edition_id = ? AND user_id = ? LIMIT 1'
  );
  const attachVoter = db.prepare(
    'UPDATE voters SET user_id = ?, nickname = ? WHERE id = ?'
  );

  for (const row of legacyRows) {
    if (!hasForEdition.get(row.edition_id, user.id)) {
      attachVoter.run(user.id, user.username, row.id);
    }
  }
}

router.get('/me', (req, res) => {
  const tokenUser = readUserFromReq(req);
  if (!tokenUser) {
    return res.json({ user: null });
  }

  const db = getDb();
  const dbUser = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(tokenUser.id);

  if (!dbUser) {
    res.clearCookie('user_token', { path: '/' });
    return res.json({ user: null });
  }

  return res.json({ user: { id: dbUser.id, username: dbUser.username } });
});

router.post('/register', (req, res) => {
  const db = getDb();
  const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  if (rawUsername.length < 2 || rawUsername.length > 30) {
    return res.status(400).json({ error: 'O usuário deve ter entre 2 e 30 caracteres.' });
  }
  if (!/^[\p{L}\p{N}._\- ]+$/u.test(rawUsername)) {
    return res
      .status(400)
      .json({ error: 'Use apenas letras, números, espaços, ponto, hífen ou underline.' });
  }
  if (rawPassword.length < 4 || rawPassword.length > 100) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
    .get(rawUsername);
  if (existing) {
    return res.status(409).json({ error: 'Este nome de usuário já está em uso.' });
  }

  const passwordHash = hashPassword(rawPassword);
  const nowIso = new Date().toISOString();

  const createAndClaim = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(rawUsername, passwordHash, nowIso);

    const newUser = { id: Number(info.lastInsertRowid), username: rawUsername };
    claimLegacyVoters(db, newUser);
    return newUser;
  });

  const user = createAndClaim();
  const token = signUserToken(user);
  setUserCookie(res, token);

  return res.status(201).json({ user });
});

router.post('/login', (req, res) => {
  const db = getDb();
  const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!rawUsername || !rawPassword) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  const user = db
    .prepare('SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER(?)')
    .get(rawUsername);

  if (!user || !verifyPassword(rawPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  const cleanUser = { id: user.id, username: user.username };
  claimLegacyVoters(db, cleanUser);
  const token = signUserToken(cleanUser);
  setUserCookie(res, token);

  return res.json({ user: cleanUser });
});

router.post('/logout', (req, res) => {
  res.clearCookie('user_token', { path: '/' });
  return res.json({ ok: true });
});

export default router;
