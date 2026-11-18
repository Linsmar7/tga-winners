import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '../../db.js';
import {
  formatEdition,
  parseWeight,
  sanitizeExternalUrl,
} from '../../lib/mappers.js';
import { getEditionCategoriesAndNominees } from '../../services/editionService.js';
import { broadcastEditionEvent } from '../../sse.js';
import { cleanupOrphanUpload } from './media.js';

const router = express.Router();

function validateEditionInput({ year, voting_start, voting_end, event_date }) {
  if (!Number.isInteger(year) || year < 2014 || year > 2100) {
    return 'Ano inválido.';
  }
  if (!voting_start || !voting_end || !event_date) {
    return 'Datas de votação e evento são obrigatórias.';
  }
  const startMs = new Date(voting_start).getTime();
  const endMs = new Date(voting_end).getTime();
  const eventMs = new Date(event_date).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(eventMs)) {
    return 'Formato de data inválido.';
  }
  if (startMs >= endMs) {
    return 'O fim da votação deve ser posterior ao início.';
  }
  return null;
}

router.get('/backup/db', async (req, res) => {
  const db = getDb();
  const tmpFile = path.join(os.tmpdir(), `tga-winners-backup-${Date.now()}.sqlite`);
  const removeTmp = () => {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  };

  try {
    await db.backup(tmpFile);
    const stamp = new Date().toISOString().slice(0, 10);
    return res.download(tmpFile, `tga-winners-backup-${stamp}.sqlite`, removeTmp);
  } catch (err) {
    removeTmp();
    return res.status(500).json({ error: err.message || 'Erro ao gerar backup do banco.' });
  }
});

router.get('/editions/:id/export', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const { enrichedCategories, sideBets } = getEditionCategoriesAndNominees(db, editionId);
  const voters = db
    .prepare('SELECT id, user_id, nickname, created_at, updated_at FROM voters WHERE edition_id = ?')
    .all(editionId);
  const votes = db
    .prepare(
      `SELECT vt.* FROM votes vt
       INNER JOIN voters vr ON vr.id = vt.voter_id
       WHERE vr.edition_id = ?`
    )
    .all(editionId);
  const sideBetVotes = db
    .prepare(
      `SELECT sbv.* FROM side_bet_votes sbv
       INNER JOIN voters vr ON vr.id = sbv.voter_id
       WHERE vr.edition_id = ?`
    )
    .all(editionId);

  const payload = {
    schema: 'tga-winners-export/v1',
    exported_at: new Date().toISOString(),
    edition: formatEdition(edition),
    categories: enrichedCategories,
    side_bets: sideBets,
    voters,
    votes,
    side_bet_votes: sideBetVotes,
  };

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="tga-${edition.year}-export.json"`
  );
  return res.json(payload);
});

router.get('/editions', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM categories c WHERE c.edition_id = e.id) AS categories_count,
        (SELECT COUNT(*) FROM nominees n INNER JOIN categories c ON c.id = n.category_id WHERE c.edition_id = e.id) AS nominees_count,
        (SELECT COUNT(*) FROM voters v WHERE v.edition_id = e.id) AS voters_count,
        (SELECT COUNT(*) FROM side_bets sb WHERE sb.edition_id = e.id) AS side_bets_count
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
  const validationErr = validateEditionInput({
    year: parsedYear,
    voting_start,
    voting_end,
    event_date,
  });
  if (validationErr) {
    return res.status(400).json({ error: validationErr });
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
      sourceEdition =
        db
          .prepare('SELECT id FROM editions WHERE year < ? ORDER BY year DESC LIMIT 1')
          .get(parsedYear) ||
        db
          .prepare('SELECT id FROM editions WHERE id != ? ORDER BY year DESC LIMIT 1')
          .get(newEditionId);
    }

    if (sourceEdition) {
      const sourceCategories = db
        .prepare(
          'SELECT name, display_order, points_weight FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC'
        )
        .all(sourceEdition.id);

      const insertCat = db.prepare(
        'INSERT INTO categories (edition_id, name, display_order, points_weight) VALUES (?, ?, ?, ?)'
      );
      for (const cat of sourceCategories) {
        insertCat.run(newEditionId, cat.name, cat.display_order, parseWeight(cat.points_weight, 5));
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

  const validationErr = validateEditionInput({ year, voting_start, voting_end, event_date });
  if (validationErr) {
    return res.status(400).json({ error: validationErr });
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
  broadcastEditionEvent(updated.year, 'edition_updated', {
    edition_id: updated.id,
    year: updated.year,
    is_finished: Boolean(updated.is_finished),
  });
  return res.json({ edition: formatEdition(updated) });
});

router.delete('/editions/:id', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const oldImages = db
    .prepare(
      `SELECT n.image_url FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ? AND n.image_url LIKE '/uploads/%'`
    )
    .all(editionId)
    .map((r) => r.image_url);

  const info = db.prepare('DELETE FROM editions WHERE id = ?').run(editionId);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }
  oldImages.forEach((img) => cleanupOrphanUpload(db, img));
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
      'SELECT name, display_order, points_weight FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC'
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
    .prepare(
      'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE edition_id = ?'
    )
    .get(targetId);
  let nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const insertTx = db.transaction(() => {
    const insert = db.prepare(
      'INSERT INTO categories (edition_id, name, display_order, points_weight) VALUES (?, ?, ?, ?)'
    );
    let added = 0;
    for (const cat of sourceCats) {
      if (existingNames.has(cat.name.trim().toLowerCase())) continue;
      insert.run(targetId, cat.name, nextOrder++, parseWeight(cat.points_weight, 5));
      added += 1;
    }
    return added;
  });

  return res.json({ imported_count: insertTx() });
});

router.post('/editions/:id/import-json', (req, res) => {
  const db = getDb();
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT * FROM editions WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'Edição destino não encontrada.' });
  }

  const rawCategories = Array.isArray(req.body?.categories)
    ? req.body.categories
    : Array.isArray(req.body)
      ? req.body
      : null;

  if (!rawCategories || rawCategories.length === 0) {
    return res
      .status(400)
      .json({ error: 'JSON inválido: informe uma lista não vazia em "categories".' });
  }

  const existingCategories = db
    .prepare('SELECT id, name, display_order FROM categories WHERE edition_id = ?')
    .all(targetId);
  const categoryByKey = new Map(
    existingCategories.map((c) => [c.name.trim().toLowerCase(), c])
  );

  let nextOrder =
    existingCategories.reduce((max, c) => Math.max(max, Number(c.display_order) || 0), 0) + 1;

  const insertCategoryStmt = db.prepare(
    'INSERT INTO categories (edition_id, name, display_order, points_weight) VALUES (?, ?, ?, ?)'
  );
  const selectNomineesStmt = db.prepare(
    'SELECT id, name, description, image_url, external_url FROM nominees WHERE category_id = ?'
  );
  const insertNomineeStmt = db.prepare(
    'INSERT INTO nominees (category_id, name, description, image_url, external_url, is_winner) VALUES (?, ?, ?, ?, ?, 0)'
  );
  const updateNomineeStmt = db.prepare(
    'UPDATE nominees SET description = ?, image_url = ?, external_url = ? WHERE id = ?'
  );

  const importTx = db.transaction(() => {
    let categoriesCreated = 0;
    let categoriesReused = 0;
    let nomineesCreated = 0;
    let nomineesUpdated = 0;
    let nomineesSkipped = 0;

    for (const rawCat of rawCategories) {
      const catName = typeof rawCat?.name === 'string' ? rawCat.name.trim() : '';
      if (!catName) continue;

      const catKey = catName.toLowerCase();
      let category = categoryByKey.get(catKey);

      if (category) {
        categoriesReused += 1;
      } else {
        const order =
          rawCat?.display_order !== undefined && rawCat?.display_order !== null
            ? Number(rawCat.display_order) || nextOrder++
            : nextOrder++;
        const weight = parseWeight(rawCat?.points_weight, 5);
        const info = insertCategoryStmt.run(targetId, catName, order, weight);
        category = { id: Number(info.lastInsertRowid), name: catName, display_order: order };
        categoryByKey.set(catKey, category);
        categoriesCreated += 1;
      }

      const rawNominees = Array.isArray(rawCat?.nominees) ? rawCat.nominees : [];
      const existingNominees = selectNomineesStmt.all(category.id);
      const nomineeByKey = new Map(
        existingNominees.map((n) => [n.name.trim().toLowerCase(), n])
      );

      for (const rawNom of rawNominees) {
        const nomName = typeof rawNom?.name === 'string' ? rawNom.name.trim() : '';
        if (!nomName) continue;

        const description =
          typeof rawNom?.description === 'string' ? rawNom.description.trim() || null : null;
        const imageUrl =
          typeof rawNom?.image_url === 'string' ? rawNom.image_url.trim() || null : null;
        const externalUrl = sanitizeExternalUrl(rawNom?.external_url);

        const nomKey = nomName.toLowerCase();
        const existingNom = nomineeByKey.get(nomKey);

        if (existingNom) {
          const nextDesc = existingNom.description || description;
          const nextImg = existingNom.image_url || imageUrl;
          const nextExt = existingNom.external_url || externalUrl;
          if (
            nextDesc !== existingNom.description ||
            nextImg !== existingNom.image_url ||
            nextExt !== existingNom.external_url
          ) {
            updateNomineeStmt.run(nextDesc, nextImg, nextExt, existingNom.id);
            existingNom.description = nextDesc;
            existingNom.image_url = nextImg;
            existingNom.external_url = nextExt;
            nomineesUpdated += 1;
          } else {
            nomineesSkipped += 1;
          }
        } else {
          const nomInfo = insertNomineeStmt.run(
            category.id,
            nomName,
            description,
            imageUrl,
            externalUrl
          );
          nomineeByKey.set(nomKey, {
            id: Number(nomInfo.lastInsertRowid),
            name: nomName,
            description,
            image_url: imageUrl,
            external_url: externalUrl,
          });
          nomineesCreated += 1;
        }
      }
    }

    return {
      ok: true,
      categories_created: categoriesCreated,
      categories_reused: categoriesReused,
      nominees_created: nomineesCreated,
      nominees_updated: nomineesUpdated,
      nominees_skipped: nomineesSkipped,
    };
  });

  return res.json(importTx());
});

export default router;
