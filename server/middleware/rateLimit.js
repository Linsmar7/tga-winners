/**
 * Rate limiter em memória (janela deslizante) para proteger rotas de autenticação.
 */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message } = {}) {
  const hits = new Map();

  // Limpeza periódica para evitar crescimento de memória
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === '1' || process.env.NODE_ENV === 'test') {
      return next();
    }

    const xff = req.headers['x-forwarded-for'];
    const ip =
      typeof xff === 'string' && xff.trim()
        ? xff.split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error:
          message ||
          `Muitas tentativas seguidas. Aguarde ${retryAfterSec}s e tente novamente.`,
      });
    }

    return next();
  };
}
