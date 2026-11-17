import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function getAdminCredentials() {
  return {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    jwtSecret: process.env.JWT_SECRET || 'tga_winners_dev_jwt_secret_change_me',
  };
}

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signAdminToken(username) {
  const { jwtSecret } = getAdminCredentials();
  return jwt.sign({ role: 'admin', user: username }, jwtSecret, { expiresIn: '7d' });
}

export function requireAdmin(req, res, next) {
  const { jwtSecret } = getAdminCredentials();
  const cookieToken = req.cookies?.admin_token;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const token = cookieToken || bearerToken;
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada ou inválida' });
  }
}
