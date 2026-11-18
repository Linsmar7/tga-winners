import express from 'express';
import {
  getAdminCredentials,
  requireAdmin,
  safeEqual,
  signAdminToken,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { isHttpsReq } from '../lib/mappers.js';
import mediaRouter, { getUploadDir } from './admin/media.js';
import editionsRouter from './admin/editions.js';
import categoriesRouter from './admin/categories.js';
import sideBetsRouter from './admin/sideBets.js';
import usersRouter from './admin/users.js';

export { getUploadDir };

const router = express.Router();

const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Muitas tentativas de login admin. Aguarde alguns minutos.',
});

router.post('/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const creds = getAdminCredentials();

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !safeEqual(username, creds.user) ||
    !safeEqual(password, creds.password)
  ) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  const token = signAdminToken(creds.user);
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttpsReq(req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return res.json({ authenticated: true, user: creds.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { path: '/' });
  return res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  return res.json({ authenticated: true, user: req.admin.user });
});

// Todas as rotas abaixo exigem autenticação admin
router.use(requireAdmin);
router.use(mediaRouter);
router.use(editionsRouter);
router.use(categoriesRouter);
router.use(sideBetsRouter);
router.use(usersRouter);

export default router;
