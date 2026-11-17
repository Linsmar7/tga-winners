import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { buildVoterDetails, computeRankingAndStats } from '../scoring.js';

const router = express.Router();

function formatEdition(row) {
  if (!row) return null;
  return {
    ...row,
    is_finished: Boolean(row.is_finished),
  };
}

function formatNominee(row) {
  if (!row) return null;
  return {
    ...row,
    is_winner: Boolean(row.is_winner),
  };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function getClientContext(req) {
  const tokenFromCookie = req.cookies?.voter_token;
  const tokenFromHeader = req.headers['x-voter-token'];
  const voterToken =
    (typeof tokenFromHeader === 'string' && tokenFromHeader.trim()) ||
    (typeof tokenFromCookie === 'string' && tokenFromCookie.trim()) ||
    null;

  const ipAddress = getClientIp(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : '';
  const deviceFingerprint =
    typeof req.headers['x-device-fingerprint'] === 'string'
      ? req.headers['x-device-fingerprint'].slice(0, 255)
      : '';

  return { voterToken, ipAddress, userAgent, deviceFingerprint };
}

function setVoterCookie(res, token) {
  res.cookie('voter_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function findEditionByParam(db, yearParam) {
  const num = Number(yearParam);
  if (!Number.isInteger(num)) return null;
  return db.prepare('SELECT * FROM editions WHERE year = ?').get(num) || null;
}

function findExistingVoterByDevice(db, editionId, { ipAddress, userAgent, deviceFingerprint }) {
  if (!ipAddress || !userAgent) return null;

  if (deviceFingerprint) {
    const exact = db
      .prepare(
        `SELECT * FROM voters
         WHERE edition_id = ? AND ip_address = ? AND user_agent = ? AND device_fingerprint = ?
         LIMIT 1`
      )
      .get(editionId, ipAddress, userAgent, deviceFingerprint);
    if (exact) return exact;
  }

  return (
    db
      .prepare(
        `SELECT * FROM voters
         WHERE edition_id = ? AND ip_address = ? AND user_agent = ?
           AND (device_fingerprint IS NULL OR device_fingerprint = '' OR ? = '')
         LIMIT 1`
      )
      .get(editionId, ipAddress, userAgent, deviceFingerprint || '') || null
  );
}

function resolveVoter(db, editionId, ctx) {
  if (ctx.voterToken) {
    const byToken = db
      .prepare('SELECT * FROM voters WHERE edition_id = ? AND voter_token = ? LIMIT 1')
      .get(editionId, ctx.voterToken);
    if (byToken) return { voter: byToken, matchedBy: 'token' };
  }

  const byDevice = findExistingVoterByDevice(db, editionId, ctx);
  if (byDevice) return { voter: byDevice, matchedBy: 'device' };

  return { voter: null, matchedBy: null };
}

function getEditionFullData(db, edition) {
  const categories = db
    .prepare('SELECT * FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC')
    .all(edition.id);

  const nominees = db
    .prepare(
      `SELECT n.* FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ?
       ORDER BY n.id ASC`
    )
    .all(edition.id)
    .map(formatNominee);

  const nomineesByCat = new Map();
  for (const n of nominees) {
    if (!nomineesByCat.has(n.category_id)) nomineesByCat.set(n.category_id, []);
    nomineesByCat.get(n.category_id).push(n);
  }

  const enrichedCategories = categories.map((cat) => ({
    ...cat,
    nominees: nomineesByCat.get(cat.id) || [],
  }));

  const votersCount = db
    .prepare('SELECT COUNT(*) AS cnt FROM voters WHERE edition_id = ?')
    .get(edition.id).cnt;

  const decidedCount = nominees.filter((n) => n.is_winner).length;

  return {
    edition: formatEdition(edition),
    categories: enrichedCategories,
    summary: {
      total_voters: votersCount,
      total_categories: categories.length,
      decided_categories: decidedCount,
    },
  };
}

router.get('/editions', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM categories c WHERE c.edition_id = e.id) AS categories_count,
        (SELECT COUNT(*) FROM voters v WHERE v.edition_id = e.id) AS voters_count
       FROM editions e
       ORDER BY e.year DESC`
    )
    .all();

  res.json({ editions: rows.map(formatEdition) });
});

router.get('/editions/active', (req, res) => {
  const db = getDb();
  const editions = db.prepare('SELECT * FROM editions ORDER BY year DESC').all();
  if (editions.length === 0) {
    return res.json({ edition: null, categories: [], summary: null });
  }

  const now = Date.now();
  const currentlyOpen = editions.find((e) => {
    const start = new Date(e.voting_start).getTime();
    const end = new Date(e.voting_end).getTime();
    return now >= start && now < end;
  });

  const active = currentlyOpen || editions[0];
  return res.json(getEditionFullData(db, active));
});

router.get('/editions/:year', (req, res) => {
  const db = getDb();
  const edition = findEditionByParam(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }
  return res.json(getEditionFullData(db, edition));
});

router.get('/editions/:year/my-votes', (req, res) => {
  const db = getDb();
  const edition = findEditionByParam(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const ctx = getClientContext(req);
  const { voter } = resolveVoter(db, edition.id, ctx);

  if (!voter) {
    return res.json({ voter: null, votes: [] });
  }

  setVoterCookie(res, voter.voter_token);
  const votes = db
    .prepare(
      'SELECT category_id, will_win_nominee_id, want_win_nominee_id FROM votes WHERE voter_id = ?'
    )
    .all(voter.id);

  return res.json({
    voter: {
      id: voter.id,
      nickname: voter.nickname,
      voter_token: voter.voter_token,
      updated_at: voter.updated_at,
    },
    votes,
  });
});

router.post('/editions/:year/votes', (req, res) => {
  const db = getDb();
  const edition = findEditionByParam(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
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

  const rawNickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim() : '';
  if (!rawNickname || rawNickname.length > 40) {
    return res
      .status(400)
      .json({ error: 'Informe um apelido válido (entre 1 e 40 caracteres).' });
  }

  const rawVotes = Array.isArray(req.body?.votes) ? req.body.votes : [];
  const ctx = getClientContext(req);
  const bodyToken =
    typeof req.body?.voter_token === 'string' && req.body.voter_token.trim()
      ? req.body.voter_token.trim()
      : null;

  const effectiveCtx = {
    ...ctx,
    voterToken: ctx.voterToken || bodyToken,
  };

  // Verifica validade de categorias e indicados
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

    const willWinId =
      item?.will_win_nominee_id != null ? Number(item.will_win_nominee_id) : null;
    const wantWinId =
      item?.want_win_nominee_id != null ? Number(item.want_win_nominee_id) : null;

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

  // Trava híbrida: verifica se existe perfil pelo token ou pelo dispositivo/IP
  let existingVoter = null;
  if (effectiveCtx.voterToken) {
    existingVoter =
      db
        .prepare('SELECT * FROM voters WHERE edition_id = ? AND voter_token = ? LIMIT 1')
        .get(edition.id, effectiveCtx.voterToken) || null;
  }

  if (!existingVoter) {
    const deviceMatch = findExistingVoterByDevice(db, edition.id, effectiveCtx);
    if (deviceMatch) {
      // Se já existe um palpite neste dispositivo/IP e o cliente veio com outro token ou sem token,
      // bloqueia criação de um segundo perfil e devolve o perfil existente para sincronização.
      const existingVotes = db
        .prepare(
          'SELECT category_id, will_win_nominee_id, want_win_nominee_id FROM votes WHERE voter_id = ?'
        )
        .all(deviceMatch.id);

      setVoterCookie(res, deviceMatch.voter_token);
      return res.status(409).json({
        error: `Já existe um palpite registrado neste dispositivo/IP (${deviceMatch.nickname}). Seus palpites anteriores foram carregados.`,
        existing_voter: {
          id: deviceMatch.id,
          nickname: deviceMatch.nickname,
          voter_token: deviceMatch.voter_token,
          updated_at: deviceMatch.updated_at,
        },
        votes: existingVotes,
      });
    }
  }

  const nowIso = new Date().toISOString();
  const finalToken = existingVoter?.voter_token || effectiveCtx.voterToken || crypto.randomUUID();

  const saveTransaction = db.transaction(() => {
    let voterId;
    if (existingVoter) {
      db.prepare(
        `UPDATE voters
         SET nickname = ?, ip_address = ?, user_agent = ?, device_fingerprint = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        rawNickname,
        effectiveCtx.ipAddress,
        effectiveCtx.userAgent,
        effectiveCtx.deviceFingerprint,
        nowIso,
        existingVoter.id
      );
      voterId = existingVoter.id;
      db.prepare('DELETE FROM votes WHERE voter_id = ?').run(voterId);
    } else {
      const result = db
        .prepare(
          `INSERT INTO voters (edition_id, nickname, voter_token, ip_address, user_agent, device_fingerprint, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          edition.id,
          rawNickname,
          finalToken,
          effectiveCtx.ipAddress,
          effectiveCtx.userAgent,
          effectiveCtx.deviceFingerprint,
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

    return voterId;
  });

  const voterId = saveTransaction();
  setVoterCookie(res, finalToken);

  return res.json({
    voter: {
      id: Number(voterId),
      nickname: rawNickname,
      voter_token: finalToken,
      updated_at: nowIso,
    },
    votes: normalizedVotes,
  });
});

router.get('/editions/:year/ranking', (req, res) => {
  const db = getDb();
  const edition = findEditionByParam(db, req.params.year);
  if (!edition) {
    return res.status(404).json({ error: 'Edição não encontrada' });
  }

  const categories = db
    .prepare('SELECT * FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC')
    .all(edition.id);
  const nominees = db
    .prepare(
      `SELECT n.* FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ?`
    )
    .all(edition.id)
    .map(formatNominee);
  const voters = db.prepare('SELECT * FROM voters WHERE edition_id = ?').all(edition.id);
  const votes = db
    .prepare(
      `SELECT vt.* FROM votes vt
       INNER JOIN voters vr ON vr.id = vt.voter_id
       WHERE vr.edition_id = ?`
    )
    .all(edition.id);

  const computed = computeRankingAndStats({ categories, nominees, voters, votes });

  return res.json({
    edition: formatEdition(edition),
    ...computed,
  });
});

router.get('/editions/:year/voters/:voterId', (req, res) => {
  const db = getDb();
  const edition = findEditionByParam(db, req.params.year);
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

  const categories = db
    .prepare('SELECT * FROM categories WHERE edition_id = ? ORDER BY display_order ASC, id ASC')
    .all(edition.id);
  const nominees = db
    .prepare(
      `SELECT n.* FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE c.edition_id = ?`
    )
    .all(edition.id)
    .map(formatNominee);
  const votes = db.prepare('SELECT * FROM votes WHERE voter_id = ?').all(voter.id);

  return res.json(buildVoterDetails({ voter, categories, nominees, votes }));
});

export default router;
