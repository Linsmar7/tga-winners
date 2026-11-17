import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import {
  getAdminCredentials,
  requireAdmin,
  safeEqual,
  signAdminToken,
} from '../middleware/auth.js';

const router = express.Router();

export function getUploadDir() {
  return process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data', 'uploads');
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

function formatEdition(row) {
  if (!row) return null;
  return { ...row, is_finished: Boolean(row.is_finished) };
}

function formatNominee(row) {
  if (!row) return null;
  return { ...row, is_winner: Boolean(row.is_winner) };
}

// --- Auth ---

router.post('/login', (req, res) => {
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

// All routes below require admin auth
router.use(requireAdmin);

// --- Upload ---

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  return res.json({ url: `/uploads/${req.file.filename}` });
});

// --- Editions ---

router.get('/editions', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM categories c WHERE c.edition_id = e.id) AS categories_count,
        (SELECT COUNT(*) FROM nominees n INNER JOIN categories c ON c.id = n.category_id WHERE c.edition_id = e.id) AS nominees_count,
        (SELECT COUNT(*) FROM voters v WHERE v.edition_id = e.id) AS voters_count
       FROM editions e
       ORDER BY e.year DESC`
    )
    .all();

  return res.json({ editions: rows.map(formatEdition) });
});

router.post('/editions', (req, res) => {
  const db = getDb();
  const { year, voting_start, voting_end, event_date, clone_from_edition_id, import_previous } =
    req.body || {};

  const parsedYear = Number(year);
  if (!Number.isInteger(parsedYear) || parsedYear < 2014 || parsedYear > 2100) {
    return res.status(400).json({ error: 'Ano inválido.' });
  }
  if (!voting_start || !voting_end || !event_date) {
    return res.status(400).json({ error: 'Datas de votação e evento são obrigatórias.' });
  }
  const startMs = new Date(voting_start).getTime();
  const endMs = new Date(voting_end).getTime();
  const eventMs = new Date(event_date).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(eventMs)) {
    return res.status(400).json({ error: 'Formato de data inválido.' });
  }
  if (startMs >= endMs) {
    return res.status(400).json({ error: 'O fim da votação deve ser posterior ao início.' });
  }

  const existing = db.prepare('SELECT id FROM editions WHERE year = ?').get(parsedYear);
  if (existing) {
    return res.status(409).json({ error: `Já existe uma edição cadastrada para ${parsedYear}.` });
  }

  const createTx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO editions (year, voting_start, voting_end, event_date, is_finished)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(
        parsedYear,
        new Date(voting_start).toISOString(),
        new Date(voting_end).toISOString(),
        new Date(event_date).toISOString()
      );

    const newEditionId = Number(info.lastInsertRowid);
    let importedCount = 0;

    let sourceEdition = null;
    if (clone_from_edition_id) {
      sourceEdition = db
        .prepare('SELECT id FROM editions WHERE id = ?')
        .get(Number(clone_from_edition_id));
    } else if (import_previous) {
      sourceEdition = db
        .prepare('SELECT id FROM editions WHERE year < ? ORDER BY year DESC LIMIT 1')
        .get(parsedYear);
      if (!sourceEdition) {
        sourceEdition = db
          .prepare('SELECT id FROM editions WHERE id != ? ORDER BY year DESC LIMIT 1')
          .get(newEditionId);
      }
    }

    if (sourceEdition) {
      const sourceCategories = db
        .prepare(
          'SELECT name, display_order FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC'
        )
        .all(sourceEdition.id);

      const insertCat = db.prepare(
        'INSERT INTO categories (edition_id, name, display_order) VALUES (?, ?, ?)'
      );
      for (const cat of sourceCategories) {
        insertCat.run(newEditionId, cat.name, cat.display_order);
        importedCount += 1;
      }
    }

    const created = db.prepare('SELECT * FROM editions WHERE id = ?').get(newEditionId);
    return { edition: formatEdition(created), imported_categories_count: importedCount };
  });

  return res.status(201).json(createTx());
});

router.put('/editions/:id', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  if (!existing) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const year = req.body?.year !== undefined ? Number(req.body.year) : existing.year;
  const voting_start = req.body?.voting_start ?? existing.voting_start;
  const voting_end = req.body?.voting_end ?? existing.voting_end;
  const event_date = req.body?.event_date ?? existing.event_date;
  const is_finished =
    req.body?.is_finished !== undefined ? (req.body.is_finished ? 1 : 0) : existing.is_finished;

  if (!Number.isInteger(year) || year < 2014 || year > 2100) {
    return res.status(400).json({ error: 'Ano inválido.' });
  }
  const startMs = new Date(voting_start).getTime();
  const endMs = new Date(voting_end).getTime();
  const eventMs = new Date(event_date).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(eventMs)) {
    return res.status(400).json({ error: 'Formato de data inválido.' });
  }
  if (startMs >= endMs) {
    return res.status(400).json({ error: 'O fim da votação deve ser posterior ao início.' });
  }

  const duplicate = db
    .prepare('SELECT id FROM editions WHERE year = ? AND id != ?')
    .get(year, editionId);
  if (duplicate) {
    return res.status(409).json({ error: `Já existe outra edição para o ano ${year}.` });
  }

  db.prepare(
    `UPDATE editions
     SET year = ?, voting_start = ?, voting_end = ?, event_date = ?, is_finished = ?
     WHERE id = ?`
  ).run(
    year,
    new Date(voting_start).toISOString(),
    new Date(voting_end).toISOString(),
    new Date(event_date).toISOString(),
    is_finished,
    editionId
  );

  const updated = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  return res.json({ edition: formatEdition(updated) });
});

router.delete('/editions/:id', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const info = db.prepare('DELETE FROM editions WHERE id = ?').run(editionId);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }
  return res.json({ ok: true });
});

router.post('/editions/:id/import-categories', (req, res) => {
  const db = getDb();
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT * FROM editions WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Edição destino não encontrada.' });
  }

  let sourceId = req.body?.source_edition_id ? Number(req.body.source_edition_id) : null;
  if (!sourceId) {
    const prev = db
      .prepare('SELECT id FROM editions WHERE year < ? ORDER BY year DESC LIMIT 1')
      .get(target.year);
    sourceId = prev?.id || null;
  }

  if (!sourceId || sourceId === targetId) {
    return res.status(400).json({ error: 'Nenhuma edição anterior encontrada para importar.' });
  }

  const sourceCats = db
    .prepare(
      'SELECT name, display_order FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC'
    )
    .all(sourceId);

  if (sourceCats.length === 0) {
    return res.status(400).json({ error: 'A edição de origem não possui categorias.' });
  }

  const existingNames = new Set(
    db
      .prepare('SELECT name FROM categories WHERE edition_id = ?')
      .all(targetId)
      .map((c) => c.name.trim().toLowerCase())
  );

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE edition_id = ?')
    .get(targetId);
  let nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const insertTx = db.transaction(() => {
    const insert = db.prepare(
      'INSERT INTO categories (edition_id, name, display_order) VALUES (?, ?, ?)'
    );
    let added = 0;
    for (const cat of sourceCats) {
      if (existingNames.has(cat.name.trim().toLowerCase())) continue;
      insert.run(targetId, cat.name, nextOrder++);
      added += 1;
    }
    return added;
  });

  const added = insertTx();
  return res.json({ imported_count: added });
});

// --- Categories ---

router.get('/editions/:id/categories', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const categories = db
    .prepare('SELECT * FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC')
    .all(editionId);

  const nominees = db
    .prepare(
      `SELECT n.* FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ?
       ORDER BY n.id ASC`
    )
    .all(editionId)
    .map(formatNominee);

  const byCat = new Map();
  for (const n of nominees) {
    if (!byCat.has(n.category_id)) byCat.set(n.category_id, []);
    byCat.get(n.category_id).push(n);
  }

  const voters = db
    .prepare('SELECT id, nickname, created_at, updated_at FROM voters WHERE edition_id = ? ORDER BY updated_at DESC')
    .all(editionId);

  return res.json({
    edition: formatEdition(edition),
    categories: categories.map((c) => ({ ...c, nominees: byCat.get(c.id) || [] })),
    voters,
  });
});

router.post('/editions/:id/categories', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const edition = db.prepare('SELECT id FROM editions WHERE id = ?').get(editionId);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }

  let displayOrder = req.body?.display_order;
  if (displayOrder === undefined || displayOrder === null || displayOrder === '') {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE edition_id = ?')
      .get(editionId);
    displayOrder = (maxRow?.max_order || 0) + 1;
  } else {
    displayOrder = Number(displayOrder) || 0;
  }

  const info = db
    .prepare('INSERT INTO categories (edition_id, name, display_order) VALUES (?, ?, ?)')
    .run(editionId, name, displayOrder);

  const created = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(Number(info.lastInsertRowid));

  return res.status(201).json({ category: { ...created, nominees: [] } });
});

router.put('/editions/:id/categories/reorder', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : null;
  if (!orderedIds) {
    return res.status(400).json({ error: 'orderedIds inválido.' });
  }

  const reorderTx = db.transaction(() => {
    const stmt = db.prepare(
      'UPDATE categories SET display_order = ? WHERE id = ? AND edition_id = ?'
    );
    orderedIds.forEach((catId, index) => {
      stmt.run(index + 1, Number(catId), editionId);
    });
  });

  reorderTx();
  return res.json({ ok: true });
});

router.put('/categories/:id', (req, res) => {
  const db = getDb();
  const categoryId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!existing) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }

  const name =
    req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
  if (!name) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }
  const displayOrder =
    req.body?.display_order !== undefined
      ? Number(req.body.display_order)
      : existing.display_order;

  db.prepare('UPDATE categories SET name = ?, display_order = ? WHERE id = ?').run(
    name,
    displayOrder,
    categoryId
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  return res.json({ category: updated });
});

router.delete('/categories/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }
  return res.json({ ok: true });
});

// --- Nominees ---

router.post('/categories/:id/nominees', (req, res) => {
  const db = getDb();
  const categoryId = Number(req.params.id);
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'Nome do indicado é obrigatório.' });
  }
  const description =
    typeof req.body?.description === 'string' ? req.body.description.trim() || null : null;
  const imageUrl =
    typeof req.body?.image_url === 'string' ? req.body.image_url.trim() || null : null;

  const info = db
    .prepare(
      'INSERT INTO nominees (category_id, name, description, image_url, is_winner) VALUES (?, ?, ?, ?, 0)'
    )
    .run(categoryId, name, description, imageUrl);

  const created = db
    .prepare('SELECT * FROM nominees WHERE id = ?')
    .get(Number(info.lastInsertRowid));

  return res.status(201).json({ nominee: formatNominee(created) });
});

router.put('/nominees/:id', (req, res) => {
  const db = getDb();
  const nomineeId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM nominees WHERE id = ?').get(nomineeId);
  if (!existing) {
    return res.status(404).json({ error: 'Indicado não encontrado.' });
  }

  const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
  if (!name) {
    return res.status(400).json({ error: 'Nome do indicado é obrigatório.' });
  }
  const description =
    req.body?.description !== undefined
      ? String(req.body.description || '').trim() || null
      : existing.description;
  const imageUrl =
    req.body?.image_url !== undefined
      ? String(req.body.image_url || '').trim() || null
      : existing.image_url;

  db.prepare('UPDATE nominees SET name = ?, description = ?, image_url = ? WHERE id = ?').run(
    name,
    description,
    imageUrl,
    nomineeId
  );

  const updated = db.prepare('SELECT * FROM nominees WHERE id = ?').get(nomineeId);
  return res.json({ nominee: formatNominee(updated) });
});

router.delete('/nominees/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM nominees WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Indicado não encontrado.' });
  }
  return res.json({ ok: true });
});

// --- Winner (Apuração) ---

router.put('/categories/:id/winner', (req, res) => {
  const db = getDb();
  const categoryId = Number(req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }

  const nomineeId = req.body?.nominee_id != null ? Number(req.body.nominee_id) : null;

  if (nomineeId !== null) {
    const nominee = db
      .prepare('SELECT id FROM nominees WHERE id = ? AND category_id = ?')
      .get(nomineeId, categoryId);
    if (!nominee) {
      return res.status(400).json({ error: 'Indicado não pertence a esta categoria.' });
    }
  }

  const setWinnerTx = db.transaction(() => {
    db.prepare('UPDATE nominees SET is_winner = 0 WHERE category_id = ?').run(categoryId);
    if (nomineeId !== null) {
      db.prepare('UPDATE nominees SET is_winner = 1 WHERE id = ?').run(nomineeId);
    }
  });

  setWinnerTx();

  const nominees = db
    .prepare('SELECT * FROM nominees WHERE category_id = ? ORDER BY id ASC')
    .all(categoryId)
    .map(formatNominee);

  return res.json({ category_id: categoryId, nominees });
});

// --- Voters management ---

router.delete('/voters/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM voters WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }
  return res.json({ ok: true });
});

export default router;
