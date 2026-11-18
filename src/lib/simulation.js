export function computeSimulatedRanking(simData, hypotheticalWinners = {}, hypotheticalSideBets = {}) {
  if (!simData) return [];

  const winnerByCat = new Map();
  for (const n of simData.nominees) {
    if (n.is_winner) winnerByCat.set(n.category_id, n.id);
  }
  for (const [catIdStr, nomId] of Object.entries(hypotheticalWinners)) {
    if (nomId != null) winnerByCat.set(Number(catIdStr), nomId);
  }

  const votesByVoter = new Map();
  for (const v of simData.votes) {
    if (!votesByVoter.has(v.voter_id)) votesByVoter.set(v.voter_id, new Map());
    votesByVoter.get(v.voter_id).set(v.category_id, v);
  }

  const sbVotesByVoter = new Map();
  for (const sv of simData.side_bet_votes || []) {
    if (!sbVotesByVoter.has(sv.voter_id)) sbVotesByVoter.set(sv.voter_id, new Map());
    sbVotesByVoter.get(sv.voter_id).set(sv.side_bet_id, sv.selected_option);
  }

  const entries = simData.voters.map((voter) => {
    const vMap = votesByVoter.get(voter.id) || new Map();
    const sbMap = sbVotesByVoter.get(voter.id) || new Map();
    let totalPoints = 0;
    let willHits = 0;
    let bonusHits = 0;
    let sbHits = 0;

    for (const cat of simData.categories) {
      const winId = winnerByCat.get(cat.id);
      if (!winId) continue;
      const vote = vMap.get(cat.id);
      if (!vote) continue;
      const weight = Number(cat.points_weight) || 5;
      if (vote.will_win_nominee_id === winId) {
        totalPoints += weight;
        willHits += 1;
      }
      if (
        vote.want_win_nominee_id === winId &&
        vote.want_win_nominee_id !== vote.will_win_nominee_id
      ) {
        totalPoints += 1;
        bonusHits += 1;
      }
    }

    for (const sb of simData.side_bets || []) {
      const official = sb.correct_option || hypotheticalSideBets[sb.id] || null;
      if (!official) continue;
      if (sbMap.get(sb.id) === official) {
        totalPoints += Number(sb.points) || 3;
        sbHits += 1;
      }
    }

    return {
      voter_id: voter.id,
      user_id: voter.user_id,
      nickname: voter.nickname,
      total_points: totalPoints,
      will_win_hits: willHits,
      want_win_bonus_hits: bonusHits,
      side_bet_hits: sbHits,
    };
  });

  entries.sort(
    (a, b) =>
      b.total_points - a.total_points ||
      b.will_win_hits - a.will_win_hits ||
      b.want_win_bonus_hits - a.want_win_bonus_hits ||
      b.side_bet_hits - a.side_bet_hits ||
      a.nickname.localeCompare(b.nickname, 'pt-BR')
  );

  let pos = 1;
  return entries.map((e, idx) => {
    if (
      idx > 0 &&
      (entries[idx - 1].total_points !== e.total_points ||
        entries[idx - 1].will_win_hits !== e.will_win_hits ||
        entries[idx - 1].want_win_bonus_hits !== e.want_win_bonus_hits ||
        entries[idx - 1].side_bet_hits !== e.side_bet_hits)
    ) {
      pos = idx + 1;
    }
    return { position: pos, ...e };
  });
}
