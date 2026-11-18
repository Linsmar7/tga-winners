import { getCategoryWeight } from './helpers.js';

/**
 * Monta o detalhe completo dos palpites de um participante específico.
 */
export function buildVoterDetails({
  voter,
  categories,
  nominees,
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

  const nomineesById = new Map(nominees.map((n) => [n.id, n]));
  const winnerByCategoryId = new Map();
  for (const n of nominees) {
    if (n.is_winner) winnerByCategoryId.set(n.category_id, n);
  }
  const voteByCategoryId = new Map(votes.map((v) => [v.category_id, v]));
  const sbVoteById = new Map(sideBetVotes.map((sv) => [sv.side_bet_id, sv.selected_option]));

  let totalPoints = 0;
  let willWinHits = 0;
  let wantWinBonusHits = 0;
  let sideBetHits = 0;
  let sideBetPoints = 0;

  const toSummaryNominee = (nom) =>
    nom ? { id: nom.id, name: nom.name, image_url: nom.image_url } : null;

  const details = orderedCategories.map((cat) => {
    const vote = voteByCategoryId.get(cat.id) || null;
    const winner = winnerByCategoryId.get(cat.id) || null;
    const weight = getCategoryWeight(cat);
    const willWinNominee = vote?.will_win_nominee_id
      ? nomineesById.get(vote.will_win_nominee_id) || null
      : null;
    const wantWinNominee = vote?.want_win_nominee_id
      ? nomineesById.get(vote.want_win_nominee_id) || null
      : null;

    let points = 0;
    let willWinCorrect = null;
    let wantWinCorrect = null;
    let upsetBonus = false;

    if (winner) {
      willWinCorrect = willWinNominee ? willWinNominee.id === winner.id : false;
      wantWinCorrect = wantWinNominee ? wantWinNominee.id === winner.id : false;
      upsetBonus = Boolean(
        wantWinCorrect &&
          wantWinNominee &&
          (!willWinNominee || wantWinNominee.id !== willWinNominee.id)
      );

      if (willWinCorrect) {
        points += weight;
        willWinHits += 1;
      }
      if (upsetBonus) {
        points += 1;
        wantWinBonusHits += 1;
      }
      totalPoints += points;
    }

    return {
      category_id: cat.id,
      category_name: cat.name,
      points_weight: weight,
      winner: toSummaryNominee(winner),
      will_win: toSummaryNominee(willWinNominee),
      want_win: toSummaryNominee(wantWinNominee),
      will_win_correct: willWinCorrect,
      want_win_correct: wantWinCorrect,
      upset_bonus: upsetBonus,
      points,
    };
  });

  const sideBetDetails = orderedSideBets.map((sb) => {
    const selected = sbVoteById.get(sb.id) || null;
    const isDecided =
      sb.correct_option !== null && sb.correct_option !== undefined && sb.correct_option !== '';
    const isCorrect = isDecided ? selected === sb.correct_option : null;
    const pts = isCorrect ? Number(sb.points) || 3 : 0;
    if (isCorrect) {
      sideBetHits += 1;
      sideBetPoints += pts;
      totalPoints += pts;
    }
    return {
      side_bet_id: sb.id,
      question: sb.question,
      points_possible: Number(sb.points) || 3,
      correct_option: isDecided ? sb.correct_option : null,
      selected_option: selected,
      is_correct: isCorrect,
      points: pts,
    };
  });

  return {
    voter: {
      id: voter.id,
      user_id: voter.user_id ?? null,
      nickname: voter.nickname,
      total_points: totalPoints,
      will_win_hits: willWinHits,
      want_win_bonus_hits: wantWinBonusHits,
      side_bet_hits: sideBetHits,
      side_bet_points: sideBetPoints,
    },
    categories: details,
    side_bets: sideBetDetails,
  };
}

/**
 * Comparação Head-to-Head entre dois participantes.
 */
export function buildHeadToHead({
  voterA,
  voterB,
  categories,
  nominees,
  votesA,
  votesB,
  sideBets = [],
  sideBetVotesA = [],
  sideBetVotesB = [],
}) {
  const detailsA = buildVoterDetails({
    voter: voterA,
    categories,
    nominees,
    votes: votesA,
    sideBets,
    sideBetVotes: sideBetVotesA,
  });
  const detailsB = buildVoterDetails({
    voter: voterB,
    categories,
    nominees,
    votes: votesB,
    sideBets,
    sideBetVotes: sideBetVotesB,
  });

  let sharedWill = 0;
  let sameWill = 0;
  let sharedWant = 0;
  let sameWant = 0;

  const comparedCategories = detailsA.categories.map((catA, idx) => {
    const catB = detailsB.categories[idx];
    const bothWill = Boolean(catA.will_win && catB.will_win);
    const bothWant = Boolean(catA.want_win && catB.want_win);
    const willMatch = bothWill && catA.will_win.id === catB.will_win.id;
    const wantMatch = bothWant && catA.want_win.id === catB.want_win.id;

    if (bothWill) {
      sharedWill += 1;
      if (willMatch) sameWill += 1;
    }
    if (bothWant) {
      sharedWant += 1;
      if (wantMatch) sameWant += 1;
    }

    const isDivergent =
      catA.will_win?.id !== catB.will_win?.id || catA.want_win?.id !== catB.want_win?.id;

    return {
      category_id: catA.category_id,
      category_name: catA.category_name,
      points_weight: catA.points_weight,
      winner: catA.winner,
      a: {
        will_win: catA.will_win,
        want_win: catA.want_win,
        will_win_correct: catA.will_win_correct,
        upset_bonus: catA.upset_bonus,
        points: catA.points,
      },
      b: {
        will_win: catB.will_win,
        want_win: catB.want_win,
        will_win_correct: catB.will_win_correct,
        upset_bonus: catB.upset_bonus,
        points: catB.points,
      },
      will_match: willMatch,
      want_match: wantMatch,
      is_divergent: isDivergent,
    };
  });

  const comparedSideBets = detailsA.side_bets.map((sbA, idx) => {
    const sbB = detailsB.side_bets[idx];
    return {
      side_bet_id: sbA.side_bet_id,
      question: sbA.question,
      correct_option: sbA.correct_option,
      points_possible: sbA.points_possible,
      a: { selected_option: sbA.selected_option, is_correct: sbA.is_correct, points: sbA.points },
      b: { selected_option: sbB.selected_option, is_correct: sbB.is_correct, points: sbB.points },
      is_divergent: sbA.selected_option !== sbB.selected_option,
    };
  });

  return {
    voter_a: detailsA.voter,
    voter_b: detailsB.voter,
    summary: {
      shared_will_count: sharedWill,
      same_will_count: sameWill,
      agreement_will_pct: sharedWill > 0 ? Math.round((sameWill / sharedWill) * 100) : 0,
      shared_want_count: sharedWant,
      same_want_count: sameWant,
      agreement_want_pct: sharedWant > 0 ? Math.round((sameWant / sharedWant) * 100) : 0,
    },
    categories: comparedCategories,
    side_bets: comparedSideBets,
  };
}
