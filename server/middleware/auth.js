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

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const computed = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

export function signAdminToken(username) {
  const { jwtSecret } = getAdminCredentials();
  return jwt.sign({ role: 'admin', user: username }, jwtSecret, { expiresIn: '7d' });
}

export function signUserToken(user) {
  const { jwtSecret } = getAdminCredentials();
  return jwt.sign(
    { role: 'user', userId: user.id, username: user.username },
    jwtSecret,
    { expiresIn: '30d' }
  );
}

export function readUserFromReq(req) {
  const { jwtSecret } = getAdminCredentials();
  const cookieToken = req.cookies?.user_token;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const token = cookieToken || bearerToken;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload?.role !== 'user' || !payload?.userId) return null;
    return { id: Number(payload.userId), username: String(payload.username) };
  } catch {
    return null;
  }
}

export function requireUser(req, res, next) {
  const user = readUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }
  req.user = user;
  return next();
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
