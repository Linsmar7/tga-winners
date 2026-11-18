import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import publicRouter from './routes/public.js';
import authRouter from './routes/auth.js';
import adminRouter, { getUploadDir } from './routes/admin.js';
import { securityHeaders } from './middleware/security.js';
import { compressionMiddleware } from './middleware/compression.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(securityHeaders);
  app.use(compressionMiddleware);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Garante existência do diretório de uploads e serve com cache moderado (7 dias)
  const uploadDir = getUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadDir, {
      maxAge: '7d',
      etag: true,
    })
  );

  // Healthcheck simples
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  // Tratamento de erros da API (ex: upload Multer)
  app.use('/api', (err, req, res, next) => {
    if (err) {
      const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
      return res.status(status).json({ error: err.message || 'Erro interno do servidor.' });
    }
    return next();
  });

  // Serve frontend Vite buildado (dist/) com cache forte para assets com hash
  const distDir = path.resolve(process.cwd(), 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    if (fs.existsSync(assetsDir)) {
      app.use(
        '/assets',
        express.static(assetsDir, {
          maxAge: '1y',
          immutable: true,
        })
      );
    }
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtml);
    });
  }

  return app;
}
