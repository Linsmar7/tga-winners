import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveNomineeMedia } from '../../lib/nomineeLookup.js';

const router = express.Router();

export function getUploadDir() {
  return process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data', 'uploads');
}

export function cleanupOrphanUpload(db, imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  if (!filename || filename === '.' || filename === '..') return;

  const refCount = db
    .prepare('SELECT COUNT(*) AS cnt FROM nominees WHERE image_url = ?')
    .get(imageUrl).cnt;
  if (refCount > 0) return;

  const filePath = path.join(getUploadDir(), filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignora erro de IO na limpeza
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUploadDir();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)
      ? ext
      : '.png';
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos.'));
    }
  },
});

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  return res.json({ url: `/uploads/${req.file.filename}` });
});

router.post('/nominees/lookup', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const kind = typeof req.body?.kind === 'string' ? req.body.kind.trim().toLowerCase() : 'game';
  if (!name) {
    return res.status(400).json({ error: 'Informe o nome do indicado para buscar.' });
  }

  try {
    const media = await resolveNomineeMedia({ name, kind });
    return res.json(media);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha ao buscar capa automaticamente.' });
  }
});

export default router;
