import {
  assignPositionsWithTies,
  getCategoryWeight,
  isGotyCategory,
} from './scoring/helpers.js';
import { computeCommunityAwardsAndBadges } from './scoring/awards.js';
import { computeEvolutionTimeline } from './scoring/evolution.js';
import { buildHeadToHead, buildVoterDetails } from './scoring/voterDetails.js';

export { buildVoterDetails, buildHeadToHead, assignPositionsWithTies };

/**
 * Calcula pontuação, ranking com empates reais, estatísticas avançadas,
 * badges, consenso por categoria e linha do tempo de evolução para uma edição.
 */
export function computeRankingAndStats({
  categories,
  nominees,
  voters,
  votes,
  sideBets = [],
  sideBetVotes = [],
}) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order || a.id - b.id
  );
  const orderedSideBets = [...sideBets].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0) || a.id - b.id
  );

  const nomineesById = new Map();
  const nomineesByCategoryId = new Map();
  const winnerByCategoryId = new Map();

  for (const nominee of nominees) {
    nomineesById.set(nominee.id, nominee);
    if (!nomineesByCategoryId.has(nominee.category_id)) {
      nomineesByCategoryId.set(nominee.category_id, []);
    }
    nomineesByCategoryId.get(nominee.category_id).push(nominee);
    if (nominee.is_winner) {
      winnerByCategoryId.set(nominee.category_id, nominee);
    }
  }

  const votesByVoter = new Map();
  const wantWinCountsByNominee = new Map();
  const willWinCountsByNominee = new Map();
  const categoryStatsMap = new Map();

  for (const cat of orderedCategories) {
    categoryStatsMap.set(cat.id, {
      category_id: cat.id,
      category_name: cat.name,
      display_order: cat.display_order,
      points_weight: getCategoryWeight(cat),
      winner: winnerByCategoryId.get(cat.id) || null,
      will_win_total: 0,
      want_win_total: 0,
      will_win_hits: 0,
      hit_voter_ids: [],
    });
  }

  for (const vote of votes) {
    if (!votesByVoter.has(vote.voter_id)) {
      votesByVoter.set(vote.voter_id, new Map());
    }
    votesByVoter.get(vote.voter_id).set(vote.category_id, vote);

    const catStat = categoryStatsMap.get(vote.category_id);

    if (vote.want_win_nominee_id != null && nomineesById.has(vote.want_win_nominee_id)) {
      wantWinCountsByNominee.set(
        vote.want_win_nominee_id,
        (wantWinCountsByNominee.get(vote.want_win_nominee_id) || 0) + 1
      );
      if (catStat) catStat.want_win_total += 1;
    }

    if (vote.will_win_nominee_id != null && nomineesById.has(vote.will_win_nominee_id)) {
      willWinCountsByNominee.set(
        vote.will_win_nominee_id,
        (willWinCountsByNominee.get(vote.will_win_nominee_id) || 0) + 1
      );
      if (catStat) {
        catStat.will_win_total += 1;
        if (catStat.winner && vote.will_win_nominee_id === catStat.winner.id) {
          catStat.will_win_hits += 1;
          catStat.hit_voter_ids.push(vote.voter_id);
        }
      }
    }
  }

  const sideBetVotesByVoter = new Map();
  for (const sbv of sideBetVotes) {
    if (!sideBetVotesByVoter.has(sbv.voter_id)) {
      sideBetVotesByVoter.set(sbv.voter_id, new Map());
    }
    sideBetVotesByVoter.get(sbv.voter_id).set(sbv.side_bet_id, sbv.selected_option);
  }

  const decidedSideBets = orderedSideBets.filter(
    (sb) => sb.correct_option !== null && sb.correct_option !== undefined && sb.correct_option !== ''
  );

  const rankingEntries = voters.map((voter) =>
    scoreSingleVoter({
      voter,
      orderedCategories,
      winnerByCategoryId,
      decidedSideBets,
      voterVotes: votesByVoter.get(voter.id) || new Map(),
      voterSideBets: sideBetVotesByVoter.get(voter.id) || new Map(),
    })
  );

  const ranking = assignPositionsWithTies(rankingEntries);

  const stats = computeCommunityAwardsAndBadges({
    orderedCategories,
    categoryStatsMap,
    wantWinCountsByNominee,
    nomineesById,
    winnerByCategoryId,
    voters,
    votesByVoter,
    ranking,
  });

  const consensus = buildCategoryConsensus({
    orderedCategories,
    categoryStatsMap,
    nomineesByCategoryId,
    willWinCountsByNominee,
    wantWinCountsByNominee,
  });

  const evolution = computeEvolutionTimeline({
    orderedCategories,
    winnerByCategoryId,
    decidedSideBets,
    voters,
    votesByVoter,
    sideBetVotesByVoter,
  });

  return {
    ranking,
    stats,
    consensus,
    evolution,
    decided_categories_count: winnerByCategoryId.size,
    categories_count: orderedCategories.length,
    decided_side_bets_count: decidedSideBets.length,
    side_bets_count: orderedSideBets.length,
  };
}

function scoreSingleVoter({
  voter,
  orderedCategories,
  winnerByCategoryId,
  decidedSideBets,
  voterVotes,
  voterSideBets,
}) {
  let totalPoints = 0;
  let willWinHits = 0;
  let wantWinBonusHits = 0;
  let sideBetHits = 0;
  let sideBetPoints = 0;
  let deludedCount = 0;
  let filledCategories = 0;
  let dreamerCount = 0;
  let pragmaticCount = 0;
  let decidedVotedCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let hitGoty = false;

  for (const cat of orderedCategories) {
    const vote = voterVotes.get(cat.id);
    if (!vote) {
      if (winnerByCategoryId.has(cat.id)) currentStreak = 0;
      continue;
    }

    const hasWill = vote.will_win_nominee_id != null;
    const hasWant = vote.want_win_nominee_id != null;

    if (hasWill || hasWant) filledCategories += 1;
    if (hasWill && hasWant) {
      if (vote.will_win_nominee_id === vote.want_win_nominee_id) dreamerCount += 1;
      else pragmaticCount += 1;
    }

    const winner = winnerByCategoryId.get(cat.id);
    if (!winner) continue;

    if (hasWill) decidedVotedCount += 1;

    const weight = getCategoryWeight(cat);
    const hitWillWin = vote.will_win_nominee_id === winner.id;
    const hitWantWin = vote.want_win_nominee_id === winner.id;
    const isUpsetBonus = hitWantWin && vote.want_win_nominee_id !== vote.will_win_nominee_id;

    if (hitWillWin) {
      totalPoints += weight;
      willWinHits += 1;
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      if (isGotyCategory(cat.name)) hitGoty = true;
    } else {
      currentStreak = 0;
    }

    if (isUpsetBonus) {
      totalPoints += 1;
      wantWinBonusHits += 1;
    }

    if (hasWant && vote.want_win_nominee_id !== winner.id) {
      deludedCount += 1;
    }
  }

  for (const sb of decidedSideBets) {
    const chosen = voterSideBets.get(sb.id);
    if (chosen && chosen === sb.correct_option) {
      const pts = Number(sb.points) || 3;
      sideBetHits += 1;
      sideBetPoints += pts;
      totalPoints += pts;
    }
  }

  const accuracyPct =
    decidedVotedCount > 0 ? Math.round((willWinHits / decidedVotedCount) * 100) : 0;

  return {
    voter_id: voter.id,
    user_id: voter.user_id ?? null,
    nickname: voter.nickname,
    total_points: totalPoints,
    will_win_hits: willWinHits,
    want_win_bonus_hits: wantWinBonusHits,
    side_bet_hits: sideBetHits,
    side_bet_points: sideBetPoints,
    deluded_count: deludedCount,
    dreamer_count: dreamerCount,
    pragmatic_count: pragmaticCount,
    best_streak: bestStreak,
    accuracy_pct: accuracyPct,
    hit_goty: hitGoty,
    filled_categories: filledCategories,
    badges: [],
  };
}

function buildCategoryConsensus({
  orderedCategories,
  categoryStatsMap,
  nomineesByCategoryId,
  willWinCountsByNominee,
  wantWinCountsByNominee,
}) {
  return orderedCategories.map((cat) => {
    const stat = categoryStatsMap.get(cat.id);
    const catNominees = nomineesByCategoryId.get(cat.id) || [];
    const totalWill = stat?.will_win_total || 0;
    const totalWant = stat?.want_win_total || 0;

    return {
      category_id: cat.id,
      category_name: cat.name,
      display_order: cat.display_order,
      points_weight: getCategoryWeight(cat),
      total_will_votes: totalWill,
      total_want_votes: totalWant,
      nominees: catNominees.map((n) => {
        const willCount = willWinCountsByNominee.get(n.id) || 0;
        const wantCount = wantWinCountsByNominee.get(n.id) || 0;
        return {
          id: n.id,
          name: n.name,
          image_url: n.image_url || null,
          is_winner: Boolean(n.is_winner),
          will_win_count: willCount,
          will_win_pct: totalWill > 0 ? Math.round((willCount / totalWill) * 100) : 0,
          want_win_count: wantCount,
          want_win_pct: totalWant > 0 ? Math.round((wantCount / totalWant) * 100) : 0,
        };
      }),
    };
  });
}
