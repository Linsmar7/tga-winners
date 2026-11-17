import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import publicRouter from './routes/public.js';
import adminRouter, { getUploadDir } from './routes/admin.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Garante existência do diretório de uploads e serve estaticamente
  const uploadDir = getUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir));

  // Healthcheck simples
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

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

  // Serve frontend Vite buildado (dist/)
  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      return res.sendFile(indexHtml);
    });
  }

  return app;
}
