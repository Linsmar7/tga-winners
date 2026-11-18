import { formatEdition, formatNominee, formatSideBet } from '../lib/mappers.js';
import { computeRankingAndStats } from '../scoring.js';

export function findEditionByYear(db, yearParam) {
  const num = Number(yearParam);
  if (!Number.isInteger(num)) return null;
  return db.prepare('SELECT * FROM editions WHERE year = ?').get(num) || null;
}

export function findActiveOrLatestEdition(db) {
  const editions = db.prepare('SELECT * FROM editions ORDER BY year DESC').all();
  if (editions.length === 0) return null;

  const now = Date.now();
  const currentlyOpen = editions.find((e) => {
    const start = new Date(e.voting_start).getTime();
    const end = new Date(e.voting_end).getTime();
    return now >= start && now < end;
  });

  return currentlyOpen || editions[0];
}

export function listAllEditionsSummary(db) {
  return db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM categories c WHERE c.edition_id = e.id) AS categories_count,
        (SELECT COUNT(*) FROM voters v WHERE v.edition_id = e.id) AS voters_count
       FROM editions e
       ORDER BY e.year DESC`
    )
    .all()
    .map(formatEdition);
}

export function getEditionCategoriesAndNominees(db, editionId) {
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

  const nomineesByCat = new Map();
  for (const n of nominees) {
    if (!nomineesByCat.has(n.category_id)) nomineesByCat.set(n.category_id, []);
    nomineesByCat.get(n.category_id).push(n);
  }

  const enrichedCategories = categories.map((cat) => ({
    ...cat,
    points_weight: Number(cat.points_weight) || 5,
    nominees: nomineesByCat.get(cat.id) || [],
  }));

  const sideBets = db
    .prepare('SELECT * FROM side_bets WHERE edition_id = ? ORDER BY display_order ASC, id ASC')
    .all(editionId)
    .map(formatSideBet);

  return { categories, nominees, enrichedCategories, sideBets };
}

export function getEditionFullData(db, edition) {
  const { categories, nominees, enrichedCategories, sideBets } = getEditionCategoriesAndNominees(
    db,
    edition.id
  );

  const votersCount = db
    .prepare('SELECT COUNT(*) AS cnt FROM voters WHERE edition_id = ?')
    .get(edition.id).cnt;

  const decidedCount = nominees.filter((n) => n.is_winner).length;

  return {
    edition: formatEdition(edition),
    editions: listAllEditionsSummary(db),
    categories: enrichedCategories,
    side_bets: sideBets,
    summary: {
      total_voters: votersCount,
      total_categories: categories.length,
      decided_categories: decidedCount,
      total_side_bets: sideBets.length,
    },
  };
}

export function getEditionScoringInputs(db, editionId) {
  const { categories, nominees, sideBets } = getEditionCategoriesAndNominees(db, editionId);

  const voters = db.prepare('SELECT * FROM voters WHERE edition_id = ?').all(editionId);
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

  return { categories, nominees, voters, votes, sideBets, sideBetVotes };
}

export function getVoterVotes(db, voterId) {
  const votes = db.prepare('SELECT * FROM votes WHERE voter_id = ?').all(voterId);
  const sideBetVotes = db.prepare('SELECT * FROM side_bet_votes WHERE voter_id = ?').all(voterId);
  return { votes, sideBetVotes };
}

export function buildAllTimeHistory(db) {
  const editions = db.prepare('SELECT * FROM editions ORDER BY year DESC').all();
  const championsByYear = [];
  const playerMap = new Map();

  for (const ed of editions) {
    const inputs = getEditionScoringInputs(db, ed.id);
    const computed = computeRankingAndStats(inputs);

    const hasDecided =
      computed.decided_categories_count > 0 || computed.decided_side_bets_count > 0;
    const leaders = hasDecided ? computed.ranking.filter((r) => r.position === 1) : [];

    championsByYear.push({
      edition_id: ed.id,
      year: ed.year,
      is_finished: Boolean(ed.is_finished),
      voters_count: inputs.voters.length,
      categories_count: computed.categories_count,
      decided_categories_count: computed.decided_categories_count,
      champions: leaders.map((l) => ({
        voter_id: l.voter_id,
        user_id: l.user_id,
        nickname: l.nickname,
        total_points: l.total_points,
        will_win_hits: l.will_win_hits,
      })),
    });

    for (const entry of computed.ranking) {
      const key = entry.user_id
        ? `user:${entry.user_id}`
        : `nick:${entry.nickname.trim().toLowerCase()}`;

      let player = playerMap.get(key);
      if (!player) {
        player = {
          key,
          user_id: entry.user_id,
          nickname: entry.nickname,
          total_points: 0,
          total_will_win_hits: 0,
          total_bonus_hits: 0,
          total_side_bet_hits: 0,
          titles: 0,
          podiums: 0,
          editions_played: 0,
          accuracy_sum: 0,
          decided_editions_played: 0,
          editions: [],
        };
        playerMap.set(key, player);
      }

      player.total_points += entry.total_points;
      player.total_will_win_hits += entry.will_win_hits;
      player.total_bonus_hits += entry.want_win_bonus_hits;
      player.total_side_bet_hits += entry.side_bet_hits || 0;
      player.editions_played += 1;

      if (hasDecided) {
        if (entry.position === 1) player.titles += 1;
        if (entry.position <= 3) player.podiums += 1;
        player.accuracy_sum += entry.accuracy_pct || 0;
        player.decided_editions_played += 1;
      }

      player.editions.push({
        year: ed.year,
        voter_id: entry.voter_id,
        is_finished: Boolean(ed.is_finished),
        position: hasDecided ? entry.position : null,
        total_points: entry.total_points,
        will_win_hits: entry.will_win_hits,
        want_win_bonus_hits: entry.want_win_bonus_hits,
        accuracy_pct: entry.accuracy_pct,
        hit_goty: entry.hit_goty,
      });
    }
  }

  const rawLeaderboard = Array.from(playerMap.values()).map((p) => ({
    key: p.key,
    user_id: p.user_id,
    nickname: p.nickname,
    total_points: p.total_points,
    total_will_win_hits: p.total_will_win_hits,
    total_bonus_hits: p.total_bonus_hits,
    total_side_bet_hits: p.total_side_bet_hits,
    titles: p.titles,
    podiums: p.podiums,
    editions_played: p.editions_played,
    avg_accuracy_pct:
      p.decided_editions_played > 0 ? Math.round(p.accuracy_sum / p.decided_editions_played) : 0,
    editions: p.editions.sort((a, b) => b.year - a.year),
  }));

  rawLeaderboard.sort(
    (a, b) =>
      b.total_points - a.total_points ||
      b.titles - a.titles ||
      b.total_will_win_hits - a.total_will_win_hits ||
      a.nickname.localeCompare(b.nickname, 'pt-BR')
  );

  let pos = 1;
  const leaderboard = rawLeaderboard.map((p, idx) => {
    if (
      idx > 0 &&
      (rawLeaderboard[idx - 1].total_points !== p.total_points ||
        rawLeaderboard[idx - 1].titles !== p.titles ||
        rawLeaderboard[idx - 1].total_will_win_hits !== p.total_will_win_hits)
    ) {
      pos = idx + 1;
    }
    return { position: pos, ...p };
  });

  return {
    editions: listAllEditionsSummary(db),
    champions_by_year: championsByYear,
    leaderboard,
  };
}
