import express from 'express';
import { getDb } from '../../db.js';
import { formatSideBet, parseWeight } from '../../lib/mappers.js';
import { broadcastEditionEvent } from '../../sse.js';

const router = express.Router();

router.post('/editions/:id/side-bets', (req, res) => {
  const db = getDb();
  const editionId = Number(req.params.id);
  const edition = db.prepare('SELECT id FROM editions WHERE id = ?').get(editionId);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada.' });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) {
    return res.status(400).json({ error: 'Pergunta é obrigatória.' });
  }

  const rawOptions = Array.isArray(req.body?.options)
    ? req.body.options.map((o) => String(o || '').trim()).filter(Boolean)
    : ['Sim', 'Não'];
  const uniqueOptions = [...new Set(rawOptions)];
  if (uniqueOptions.length < 2) {
    return res.status(400).json({ error: 'Informe pelo menos 2 opções distintas.' });
  }

  const points = parseWeight(req.body?.points, 3);
  const maxRow = db
    .prepare(
      'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM side_bets WHERE edition_id = ?'
    )
    .get(editionId);
  const displayOrder = (maxRow?.max_order || 0) + 1;

  const info = db
    .prepare(
      `INSERT INTO side_bets (edition_id, question, options_json, points, display_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(editionId, question, JSON.stringify(uniqueOptions), points, displayOrder);

  const created = db
    .prepare('SELECT * FROM side_bets WHERE id = ?')
    .get(Number(info.lastInsertRowid));
  return res.status(201).json({ side_bet: formatSideBet(created) });
});

router.put('/side-bets/:id', (req, res) => {
  const db = getDb();
  const sbId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM side_bets WHERE id = ?').get(sbId);
  if (!existing) {
    return res.status(404).json({ error: 'Palpite extra não encontrado.' });
  }

  const question =
    req.body?.question !== undefined ? String(req.body.question).trim() : existing.question;
  if (!question) {
    return res.status(400).json({ error: 'Pergunta é obrigatória.' });
  }

  let optionsJson = existing.options_json;
  if (Array.isArray(req.body?.options)) {
    const clean = [
      ...new Set(req.body.options.map((o) => String(o || '').trim()).filter(Boolean)),
    ];
    if (clean.length < 2) {
      return res.status(400).json({ error: 'Informe pelo menos 2 opções distintas.' });
    }
    optionsJson = JSON.stringify(clean);
  }

  const points =
    req.body?.points !== undefined
      ? parseWeight(req.body.points, existing.points)
      : existing.points;

  db.prepare('UPDATE side_bets SET question = ?, options_json = ?, points = ? WHERE id = ?').run(
    question,
    optionsJson,
    points,
    sbId
  );

  const updated = db.prepare('SELECT * FROM side_bets WHERE id = ?').get(sbId);
  return res.json({ side_bet: formatSideBet(updated) });
});

router.put('/side-bets/:id/answer', (req, res) => {
  const db = getDb();
  const sbId = Number(req.params.id);
  const existing = db
    .prepare(
      `SELECT sb.*, e.year AS edition_year
       FROM side_bets sb
       INNER JOIN editions e ON e.id = sb.edition_id
       WHERE sb.id = ?`
    )
    .get(sbId);
  if (!existing) {
    return res.status(404).json({ error: 'Palpite extra não encontrado.' });
  }

  const formatted = formatSideBet(existing);
  const answer =
    req.body?.correct_option !== null && req.body?.correct_option !== undefined
      ? String(req.body.correct_option).trim() || null
      : null;

  if (answer !== null && !formatted.options.includes(answer)) {
    return res.status(400).json({ error: 'Resposta inválida para este palpite extra.' });
  }

  const decidedAt = answer ? new Date().toISOString() : null;
  db.prepare('UPDATE side_bets SET correct_option = ?, decided_at = ? WHERE id = ?').run(
    answer,
    decidedAt,
    sbId
  );

  const updated = formatSideBet(db.prepare('SELECT * FROM side_bets WHERE id = ?').get(sbId));
  broadcastEditionEvent(existing.edition_year, 'side_bet_updated', {
    side_bet_id: updated.id,
    question: updated.question,
    correct_option: updated.correct_option,
    points: updated.points,
    decided_at: updated.decided_at,
  });

  return res.json({ side_bet: updated });
});

router.delete('/side-bets/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM side_bets WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Palpite extra não encontrado.' });
  }
  return res.json({ ok: true });
});

export default router;
