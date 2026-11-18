import express from 'express';
import { getDb } from '../../db.js';
import {
  formatEdition,
  formatNominee,
  parseWeight,
  sanitizeExternalUrl,
} from '../../lib/mappers.js';
import { getEditionCategoriesAndNominees } from '../../services/editionService.js';
import { broadcastEditionEvent } from '../../sse.js';
import { cleanupOrphanUpload } from './media.js';

const router = express.Router();

router.get('/editions/:id/categories', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const { enrichedCategories, sideBets } = getEditionCategoriesAndNominees(db, editionId);

  const voters = db
    .prepare(
      'SELECT id, user_id, nickname, created_at, updated_at FROM voters WHERE edition_id = ? ORDER BY updated_at DESC'
    )
    .all(editionId);

  const users = db
    .prepare('SELECT id, username, created_at FROM users ORDER BY LOWER(username) ASC')
    .all();

  return res.json({
    edition: formatEdition(edition),
    categories: enrichedCategories,
    side_bets: sideBets,
    voters,
    users,
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
      .prepare(
        'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE edition_id = ?'
      )
      .get(editionId);
    displayOrder = (maxRow?.max_order || 0) + 1;
  } else {
    displayOrder = Number(displayOrder) || 0;
  }

  const pointsWeight = parseWeight(req.body?.points_weight, 5);

  const info = db
    .prepare(
      'INSERT INTO categories (edition_id, name, display_order, points_weight) VALUES (?, ?, ?, ?)'
    )
    .run(editionId, name, displayOrder, pointsWeight);

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

  const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
  if (!name) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  }
  const displayOrder =
    req.body?.display_order !== undefined ? Number(req.body.display_order) : existing.display_order;
  const pointsWeight =
    req.body?.points_weight !== undefined
      ? parseWeight(req.body.points_weight, existing.points_weight || 5)
      : existing.points_weight || 5;

  db.prepare(
    'UPDATE categories SET name = ?, display_order = ?, points_weight = ? WHERE id = ?'
  ).run(name, displayOrder, pointsWeight, categoryId);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  return res.json({ category: updated });
});

router.delete('/categories/:id', (req, res) => {
  const db = getDb();
  const categoryId = Number(req.params.id);
  const oldImages = db
    .prepare("SELECT image_url FROM nominees WHERE category_id = ? AND image_url LIKE '/uploads/%'")
    .all(categoryId)
    .map((r) => r.image_url);

  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }
  oldImages.forEach((img) => cleanupOrphanUpload(db, img));
  return res.json({ ok: true });
});

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
  const externalUrl = sanitizeExternalUrl(req.body?.external_url);

  const info = db
    .prepare(
      'INSERT INTO nominees (category_id, name, description, image_url, external_url, is_winner) VALUES (?, ?, ?, ?, ?, 0)'
    )
    .run(categoryId, name, description, imageUrl, externalUrl);

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
  const externalUrl =
    req.body?.external_url !== undefined
      ? sanitizeExternalUrl(req.body.external_url)
      : existing.external_url;

  db.prepare(
    'UPDATE nominees SET name = ?, description = ?, image_url = ?, external_url = ? WHERE id = ?'
  ).run(name, description, imageUrl, externalUrl, nomineeId);

  if (existing.image_url && existing.image_url !== imageUrl) {
    cleanupOrphanUpload(db, existing.image_url);
  }

  const updated = db.prepare('SELECT * FROM nominees WHERE id = ?').get(nomineeId);
  return res.json({ nominee: formatNominee(updated) });
});

router.delete('/nominees/:id', (req, res) => {
  const db = getDb();
  const nomineeId = Number(req.params.id);
  const existing = db.prepare('SELECT image_url FROM nominees WHERE id = ?').get(nomineeId);
  const info = db.prepare('DELETE FROM nominees WHERE id = ?').run(nomineeId);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Indicado não encontrado.' });
  }
  if (existing?.image_url) {
    cleanupOrphanUpload(db, existing.image_url);
  }
  return res.json({ ok: true });
});

router.put('/categories/:id/winner', (req, res) => {
  const db = getDb();
  const categoryId = Number(req.params.id);
  const category = db
    .prepare(
      `SELECT c.*, e.year AS edition_year
       FROM categories c
       INNER JOIN editions e ON e.id = c.edition_id
       WHERE c.id = ?`
    )
    .get(categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }

  const nomineeId = req.body?.nominee_id != null ? Number(req.body.nominee_id) : null;
  let winnerNominee = null;

  if (nomineeId !== null) {
    winnerNominee = db
      .prepare('SELECT * FROM nominees WHERE id = ? AND category_id = ?')
      .get(nomineeId, categoryId);
    if (!winnerNominee) {
      return res.status(400).json({ error: 'Indicado não pertence a esta categoria.' });
    }
  }

  const decidedAt = new Date().toISOString();

  const setWinnerTx = db.transaction(() => {
    db.prepare('UPDATE nominees SET is_winner = 0, decided_at = NULL WHERE category_id = ?').run(
      categoryId
    );
    if (nomineeId !== null) {
      db.prepare('UPDATE nominees SET is_winner = 1, decided_at = ? WHERE id = ?').run(
        decidedAt,
        nomineeId
      );
    }
  });

  setWinnerTx();

  const nominees = db
    .prepare('SELECT * FROM nominees WHERE category_id = ? ORDER BY id ASC')
    .all(categoryId)
    .map(formatNominee);

  broadcastEditionEvent(category.edition_year, 'winner_updated', {
    category_id: categoryId,
    category_name: category.name,
    points_weight: Number(category.points_weight) || 5,
    winner: winnerNominee
      ? {
          id: winnerNominee.id,
          name: winnerNominee.name,
          image_url: winnerNominee.image_url || null,
          decided_at: decidedAt,
        }
      : null,
  });

  return res.json({ category_id: categoryId, nominees });
});

export default router;
