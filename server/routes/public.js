import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { readUserFromReq, requireUser } from '../middleware/auth.js';
import { formatEdition, formatSideBet, getClientContext } from '../lib/mappers.js';
import {
  buildAllTimeHistory,
  findActiveOrLatestEdition,
  findEditionByYear,
  getEditionCategoriesAndNominees,
  getEditionFullData,
  getEditionScoringInputs,
  getVoterVotes,
  listAllEditionsSummary,
} from '../services/editionService.js';
import { buildHeadToHead, buildVoterDetails, computeRankingAndStats } from '../scoring.js';
import { registerSseClient } from '../sse.js';

const router = express.Router();

router.get('/editions', (req, res) => {
  const db = getDb();
  return res.json({ editions: listAllEditionsSummary(db) });
});

router.get('/editions/active', (req, res) => {
  const db = getDb();
  const active = findActiveOrLatestEdition(db);
  if (!active) {
    return res.json({ edition: null, editions: [], categories: [], side_bets: [], summary: null });
  }
  return res.json(getEditionFullData(db, active));
});

router.get('/editions/:year', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }
  return res.json(getEditionFullData(db, edition));
});

router.get('/editions/:year/stream', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }
  return registerSseClient(edition.year, req, res);
});

router.get('/editions/:year/my-votes', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const authUser = readUserFromReq(req);
  if (!authUser) {
    return res.json({ user: null, voter: null, votes: [], side_bet_votes: [] });
  }

  const dbUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(authUser.id);
  if (!dbUser) {
    return res.json({ user: null, voter: null, votes: [], side_bet_votes: [] });
  }

  const voter =
    db
      .prepare('SELECT * FROM voters WHERE edition_id = ? AND user_id = ? LIMIT 1')
      .get(edition.id, dbUser.id) || null;

  if (!voter) {
    return res.json({ user: dbUser, voter: null, votes: [], side_bet_votes: [] });
  }

  const votes = db
    .prepare(
      'SELECT category_id, will_win_nominee_id, want_win_nominee_id FROM votes WHERE voter_id = ?'
    )
    .all(voter.id);

  const sideBetVotes = db
    .prepare('SELECT side_bet_id, selected_option FROM side_bet_votes WHERE voter_id = ?')
    .all(voter.id);

  return res.json({
    user: dbUser,
    voter: {
      id: voter.id,
      nickname: voter.nickname,
      updated_at: voter.updated_at,
    },
    votes,
    side_bet_votes: sideBetVotes,
  });
});

router.post('/editions/:year/votes', requireUser, (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const dbUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.user.id);
  if (!dbUser) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }

  const now = Date.now();
  const votingStart = new Date(edition.voting_start).getTime();
  const votingEnd = new Date(edition.voting_end).getTime();

  if (now < votingStart) {
    return res.status(403).json({ error: 'A votação para esta edição ainda não começou.' });
  }
  if (now >= votingEnd) {
    return res.status(403).json({ error: 'A votação para esta edição já foi encerrada.' });
  }

  const rawVotes = Array.isArray(req.body?.votes) ? req.body.votes : [];
  const hasSideBetPayload = Array.isArray(req.body?.side_bet_votes);
  const rawSideBetVotes = hasSideBetPayload ? req.body.side_bet_votes : [];
  const ctx = getClientContext(req);

  const editionCategories = db
    .prepare('SELECT id FROM categories WHERE edition_id = ?')
    .all(edition.id);
  const validCategoryIds = new Set(editionCategories.map((c) => c.id));

  const editionNominees = db
    .prepare(
      `SELECT n.id, n.category_id FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ?`
    )
    .all(edition.id);
  const nomineeCategoryMap = new Map(editionNominees.map((n) => [n.id, n.category_id]));

  const normalizedVotes = [];
  for (const item of rawVotes) {
    const categoryId = Number(item?.category_id);
    if (!validCategoryIds.has(categoryId)) {
      return res.status(400).json({ error: `Categoria inválida: ${item?.category_id}` });
    }

    const willWinId = item?.will_win_nominee_id != null ? Number(item.will_win_nominee_id) : null;
    const wantWinId = item?.want_win_nominee_id != null ? Number(item.want_win_nominee_id) : null;

    if (willWinId !== null && nomineeCategoryMap.get(willWinId) !== categoryId) {
      return res.status(400).json({ error: 'Indicado inválido para "Vai Ganhar".' });
    }
    if (wantWinId !== null && nomineeCategoryMap.get(wantWinId) !== categoryId) {
      return res.status(400).json({ error: 'Indicado inválido para "Quero que Ganhe".' });
    }

    if (willWinId !== null || wantWinId !== null) {
      normalizedVotes.push({
        category_id: categoryId,
        will_win_nominee_id: willWinId,
        want_win_nominee_id: wantWinId,
      });
    }
  }

  const editionSideBets = db
    .prepare('SELECT * FROM side_bets WHERE edition_id = ?')
    .all(edition.id)
    .map(formatSideBet);
  const sideBetById = new Map(editionSideBets.map((sb) => [sb.id, sb]));

  const normalizedSideBetVotes = [];
  if (hasSideBetPayload) {
    for (const item of rawSideBetVotes) {
      const sbId = Number(item?.side_bet_id);
      const option = typeof item?.selected_option === 'string' ? item.selected_option.trim() : '';
      if (!option) continue;
      const sb = sideBetById.get(sbId);
      if (!sb) {
        return res.status(400).json({ error: `Palpite extra inválido: ${item?.side_bet_id}` });
      }
      if (!sb.options.includes(option)) {
        return res.status(400).json({ error: `Opção inválida para "${sb.question}".` });
      }
      normalizedSideBetVotes.push({ side_bet_id: sbId, selected_option: option });
    }
  }

  const existingVoter =
    db
      .prepare('SELECT * FROM voters WHERE edition_id = ? AND user_id = ? LIMIT 1')
      .get(edition.id, dbUser.id) || null;

  const nowIso = new Date().toISOString();
  const finalToken = existingVoter?.voter_token || crypto.randomUUID();

  const saveTransaction = db.transaction(() => {
    let voterId;
    if (existingVoter) {
      db.prepare(
        `UPDATE voters
         SET nickname = ?, ip_address = ?, user_agent = ?, device_fingerprint = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        dbUser.username,
        ctx.ipAddress,
        ctx.userAgent,
        ctx.deviceFingerprint,
        nowIso,
        existingVoter.id
      );
      voterId = existingVoter.id;
      db.prepare('DELETE FROM votes WHERE voter_id = ?').run(voterId);
    } else {
      const result = db
        .prepare(
          `INSERT INTO voters (edition_id, user_id, nickname, voter_token, ip_address, user_agent, device_fingerprint, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          edition.id,
          dbUser.id,
          dbUser.username,
          finalToken,
          ctx.ipAddress,
          ctx.userAgent,
          ctx.deviceFingerprint,
          nowIso,
          nowIso
        );
      voterId = result.lastInsertRowid;
    }

    const insertVote = db.prepare(
      `INSERT INTO votes (voter_id, category_id, will_win_nominee_id, want_win_nominee_id)
       VALUES (?, ?, ?, ?)`
    );
    for (const v of normalizedVotes) {
      insertVote.run(voterId, v.category_id, v.will_win_nominee_id, v.want_win_nominee_id);
    }

    if (hasSideBetPayload) {
      db.prepare('DELETE FROM side_bet_votes WHERE voter_id = ?').run(voterId);
      const insertSb = db.prepare(
        `INSERT INTO side_bet_votes (voter_id, side_bet_id, selected_option)
         VALUES (?, ?, ?)`
      );
      for (const sv of normalizedSideBetVotes) {
        insertSb.run(voterId, sv.side_bet_id, sv.selected_option);
      }
    }

    return voterId;
  });

  const voterId = saveTransaction();
  const savedSideBetVotes = db
    .prepare('SELECT side_bet_id, selected_option FROM side_bet_votes WHERE voter_id = ?')
    .all(voterId);

  return res.json({
    voter: {
      id: Number(voterId),
      nickname: dbUser.username,
      updated_at: nowIso,
    },
    votes: normalizedVotes,
    side_bet_votes: savedSideBetVotes,
  });
});

router.get('/editions/:year/ranking', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const inputs = getEditionScoringInputs(db, edition.id);
  const computed = computeRankingAndStats(inputs);

  return res.json({
    edition: formatEdition(edition),
    editions: listAllEditionsSummary(db),
    ...computed,
  });
});

router.get('/editions/:year/simulation-data', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const { categories, nominees, voters, votes, sideBets, sideBetVotes } = getEditionScoringInputs(
    db,
    edition.id
  );

  return res.json({
    edition: formatEdition(edition),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      display_order: c.display_order,
      points_weight: Number(c.points_weight) || 5,
    })),
    nominees: nominees.map((n) => ({
      id: n.id,
      category_id: n.category_id,
      name: n.name,
      image_url: n.image_url,
      is_winner: n.is_winner,
    })),
    voters: voters.map((v) => ({ id: v.id, user_id: v.user_id, nickname: v.nickname })),
    votes: votes.map((v) => ({
      voter_id: v.voter_id,
      category_id: v.category_id,
      will_win_nominee_id: v.will_win_nominee_id,
      want_win_nominee_id: v.want_win_nominee_id,
    })),
    side_bets: sideBets,
    side_bet_votes: sideBetVotes.map((sv) => ({
      voter_id: sv.voter_id,
      side_bet_id: sv.side_bet_id,
      selected_option: sv.selected_option,
    })),
  });
});

// Palpites sempre públicos/visíveis para todos os participantes
router.get('/editions/:year/voters/:voterId', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const voterId = Number(req.params.voterId);
  const voter = db
    .prepare('SELECT * FROM voters WHERE id = ? AND edition_id = ?')
    .get(voterId, edition.id);
  if (!voter) {
    return res.status(404).json({ error: 'Participante não encontrado' });
  }

  const { categories, nominees, sideBets } = getEditionCategoriesAndNominees(db, edition.id);
  const { votes, sideBetVotes } = getVoterVotes(db, voter.id);

  return res.json(
    buildVoterDetails({ voter, categories, nominees, votes, sideBets, sideBetVotes })
  );
});

router.get('/editions/:year/compare', (req, res) => {
  const db = getDb();
  const edition = findEditionByYear(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const voterAId = Number(req.query.a);
  const voterBId = Number(req.query.b);
  if (!Number.isInteger(voterAId) || !Number.isInteger(voterBId)) {
    return res.status(400).json({ error: 'Informe dois participantes válidos (a e b).' });
  }

  const voterA = db
    .prepare('SELECT * FROM voters WHERE id = ? AND edition_id = ?')
    .get(voterAId, edition.id);
  const voterB = db
    .prepare('SELECT * FROM voters WHERE id = ? AND edition_id = ?')
    .get(voterBId, edition.id);
  if (!voterA || !voterB) {
    return res.status(404).json({ error: 'Participante não encontrado nesta edição.' });
  }

  const { categories, nominees, sideBets } = getEditionCategoriesAndNominees(db, edition.id);
  const { votes: votesA, sideBetVotes: sideBetVotesA } = getVoterVotes(db, voterA.id);
  const { votes: votesB, sideBetVotes: sideBetVotesB } = getVoterVotes(db, voterB.id);

  return res.json(
    buildHeadToHead({
      voterA,
      voterB,
      categories,
      nominees,
      votesA,
      votesB,
      sideBets,
      sideBetVotesA,
      sideBetVotesB,
    })
  );
});

router.get('/history', (req, res) => {
  const db = getDb();
  return res.json(buildAllTimeHistory(db));
});

export default router;
