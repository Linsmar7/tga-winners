import zlib from 'node:zlib';

const COMPRESSIBLE_RE =
  /^(text\/|application\/json|application\/javascript|application\/manifest\+json|image\/svg\+xml)/i;

/**
 * Middleware leve de compressão (Brotli / Gzip) usando node:zlib nativo.
 * Ignora rotas SSE (text/event-stream) e respostas muito pequenas (< 1KB).
 */
export function compressionMiddleware(req, res, next) {
  if (req.method === 'HEAD' || req.path.endsWith('/stream')) {
    return next();
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const useBr = acceptEncoding.includes('br');
  const useGzip = !useBr && acceptEncoding.includes('gzip');
  if (!useBr && !useGzip) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const jsonStr = JSON.stringify(body);
    if (jsonStr.length < 1024) {
      return originalJson(body);
    }
    const buf = Buffer.from(jsonStr, 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');

    if (useBr) {
      const compressed = zlib.brotliCompressSync(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
      });
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Length', String(compressed.length));
      return res.send(compressed);
    }

    const compressed = zlib.gzipSync(buf, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(compressed.length));
    return res.send(compressed);
  };

  // Para assets estáticos (HTML/CSS/JS/SVG), comprime via stream quando aplicável
  const originalSend = res.send.bind(res);
  res.send = (chunk) => {
    if (res.getHeader('Content-Encoding')) {
      return originalSend(chunk);
    }
    const ct = String(res.getHeader('Content-Type') || '');
    if (!COMPRESSIBLE_RE.test(ct)) {
      return originalSend(chunk);
    }
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === 'string'
        ? Buffer.from(chunk, 'utf8')
        : null;
    if (!buf || buf.length < 1024) {
      return originalSend(chunk);
    }

    res.setHeader('Vary', 'Accept-Encoding');
    if (useBr) {
      const compressed = zlib.brotliCompressSync(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
      });
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Length', String(compressed.length));
      return originalSend(compressed);
    }
    const compressed = zlib.gzipSync(buf, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(compressed.length));
    return originalSend(compressed);
  };

  return next();
}
