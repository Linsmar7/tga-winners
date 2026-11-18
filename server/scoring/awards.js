/**
 * Calcula estatísticas coletivas da edição (Barbada, Zebra, Queridinho, Mais Iludido,
 * Oráculo, Sonhador, Pragmático, Gêmeos, Rivais, Único Visionário) e anexa badges
 * divertidas a cada participante do ranking.
 */
export function computeCommunityAwardsAndBadges({
  orderedCategories,
  categoryStatsMap,
  wantWinCountsByNominee,
  nomineesById,
  winnerByCategoryId,
  voters,
  votesByVoter,
  ranking,
}) {
  const votersById = new Map(voters.map((v) => [v.id, v]));
  const uniqueVisionaries = [];
  const visionaryVoterIds = new Set();

  for (const stat of categoryStatsMap.values()) {
    if (stat.winner && stat.will_win_total >= 2 && stat.hit_voter_ids.length === 1) {
      const voterId = stat.hit_voter_ids[0];
      const voter = votersById.get(voterId);
      if (voter) {
        visionaryVoterIds.add(voterId);
        uniqueVisionaries.push({
          voter_id: voterId,
          nickname: voter.nickname,
          category_id: stat.category_id,
          category_name: stat.category_name,
          winner_name: stat.winner.name,
          winner_image_url: stat.winner.image_url || null,
          total_votes: stat.will_win_total,
        });
      }
    }
  }

  const decidedWithVotes = Array.from(categoryStatsMap.values()).filter(
    (s) => s.winner !== null && s.will_win_total > 0
  );

  let barbada = null;
  let zebra = null;

  if (decidedWithVotes.length > 0) {
    const withPct = decidedWithVotes.map((s) => ({
      ...s,
      percentage: Math.round((s.will_win_hits / s.will_win_total) * 100),
      ratio: s.will_win_hits / s.will_win_total,
    }));

    const best = [...withPct].sort(
      (a, b) =>
        b.ratio - a.ratio ||
        b.will_win_hits - a.will_win_hits ||
        a.display_order - b.display_order
    )[0];

    barbada = {
      category_id: best.category_id,
      category_name: best.category_name,
      winner_name: best.winner.name,
      winner_image_url: best.winner.image_url || null,
      hits: best.will_win_hits,
      total_votes: best.will_win_total,
      percentage: best.percentage,
    };

    const hardest = [...withPct].sort(
      (a, b) =>
        a.ratio - b.ratio ||
        a.will_win_hits - b.will_win_hits ||
        a.display_order - b.display_order
    )[0];

    zebra = {
      category_id: hardest.category_id,
      category_name: hardest.category_name,
      winner_name: hardest.winner.name,
      winner_image_url: hardest.winner.image_url || null,
      hits: hardest.will_win_hits,
      total_votes: hardest.will_win_total,
      percentage: hardest.percentage,
    };
  }

  let queridinho = null;
  if (wantWinCountsByNominee.size > 0) {
    const categoriesById = new Map(orderedCategories.map((c) => [c.id, c]));
    let topNominee = null;
    let topCount = 0;

    for (const [nomineeId, count] of wantWinCountsByNominee.entries()) {
      if (count > topCount) {
        topCount = count;
        topNominee = nomineesById.get(nomineeId) || null;
      }
    }

    if (topNominee) {
      const cat = categoriesById.get(topNominee.category_id);
      queridinho = {
        nominee_id: topNominee.id,
        nominee_name: topNominee.name,
        image_url: topNominee.image_url || null,
        category_name: cat ? cat.name : '',
        votes_count: topCount,
      };
    }
  }

  const hasAnyWinner = winnerByCategoryId.size > 0;

  let maisIludido = null;
  if (hasAnyWinner && ranking.length > 0) {
    const topDeluded = [...ranking]
      .filter((r) => r.deluded_count > 0)
      .sort(
        (a, b) =>
          b.deluded_count - a.deluded_count || a.nickname.localeCompare(b.nickname, 'pt-BR')
      )[0];

    if (topDeluded) {
      maisIludido = {
        voter_id: topDeluded.voter_id,
        nickname: topDeluded.nickname,
        lost_want_win_count: topDeluded.deluded_count,
      };
    }
  }

  let oracle = null;
  if (hasAnyWinner && ranking.length > 0) {
    const topOracle = [...ranking]
      .filter((r) => r.will_win_hits > 0)
      .sort(
        (a, b) =>
          b.best_streak - a.best_streak ||
          b.accuracy_pct - a.accuracy_pct ||
          b.will_win_hits - a.will_win_hits ||
          a.nickname.localeCompare(b.nickname, 'pt-BR')
      )[0];

    if (topOracle) {
      oracle = {
        voter_id: topOracle.voter_id,
        nickname: topOracle.nickname,
        best_streak: topOracle.best_streak,
        accuracy_pct: topOracle.accuracy_pct,
        will_win_hits: topOracle.will_win_hits,
      };
    }
  }

  const topDreamer = [...ranking]
    .filter((r) => r.dreamer_count > 0)
    .sort(
      (a, b) => b.dreamer_count - a.dreamer_count || a.nickname.localeCompare(b.nickname, 'pt-BR')
    )[0];
  const dreamer = topDreamer
    ? {
        voter_id: topDreamer.voter_id,
        nickname: topDreamer.nickname,
        count: topDreamer.dreamer_count,
      }
    : null;

  const topPragmatic = [...ranking]
    .filter((r) => r.pragmatic_count > 0)
    .sort(
      (a, b) =>
        b.pragmatic_count - a.pragmatic_count || a.nickname.localeCompare(b.nickname, 'pt-BR')
    )[0];
  const pragmatic = topPragmatic
    ? {
        voter_id: topPragmatic.voter_id,
        nickname: topPragmatic.nickname,
        count: topPragmatic.pragmatic_count,
      }
    : null;

  const { twins, rivals } = computePairSimilarity({ voters, votesByVoter, orderedCategories });

  for (const entry of ranking) {
    const badges = [];
    if (entry.hit_goty) badges.push({ id: 'goty', label: 'Cravou o GOTY', icon: '👑' });
    if (visionaryVoterIds.has(entry.voter_id)) {
      badges.push({ id: 'visionary', label: 'Único Visionário', icon: '🦄' });
    }
    if (oracle && oracle.voter_id === entry.voter_id) {
      badges.push({ id: 'oracle', label: 'Oráculo', icon: '🔮' });
    }
    if (maisIludido && maisIludido.voter_id === entry.voter_id) {
      badges.push({ id: 'iludido', label: 'Mais Iludido', icon: '🤡' });
    }
    if (dreamer && dreamer.voter_id === entry.voter_id && entry.dreamer_count >= 2) {
      badges.push({ id: 'dreamer', label: 'Sonhador', icon: '💭' });
    }
    if (pragmatic && pragmatic.voter_id === entry.voter_id && entry.pragmatic_count >= 2) {
      badges.push({ id: 'pragmatic', label: 'Pragmático', icon: '🧠' });
    }
    entry.badges = badges;
  }

  return {
    barbada,
    zebra,
    queridinho,
    mais_iludido: maisIludido,
    oracle,
    unique_visionaries: uniqueVisionaries,
    dreamer,
    pragmatic,
    twins,
    rivals,
  };
}

function computePairSimilarity({ voters, votesByVoter, orderedCategories }) {
  if (voters.length < 2) return { twins: null, rivals: null };

  let bestPair = null;
  let worstPair = null;

  for (let i = 0; i < voters.length; i++) {
    const vA = voters[i];
    const mapA = votesByVoter.get(vA.id);
    if (!mapA) continue;

    for (let j = i + 1; j < voters.length; j++) {
      const vB = voters[j];
      const mapB = votesByVoter.get(vB.id);
      if (!mapB) continue;

      let shared = 0;
      let same = 0;
      for (const cat of orderedCategories) {
        const aWill = mapA.get(cat.id)?.will_win_nominee_id;
        const bWill = mapB.get(cat.id)?.will_win_nominee_id;
        if (aWill != null && bWill != null) {
          shared += 1;
          if (aWill === bWill) same += 1;
        }
      }
      if (shared === 0) continue;

      const ratio = same / shared;
      const pair = {
        voter_a_id: vA.id,
        voter_a_nickname: vA.nickname,
        voter_b_id: vB.id,
        voter_b_nickname: vB.nickname,
        same_count: same,
        shared_count: shared,
        percentage: Math.round(ratio * 100),
        ratio,
      };

      if (
        !bestPair ||
        pair.ratio > bestPair.ratio ||
        (pair.ratio === bestPair.ratio && pair.shared_count > bestPair.shared_count)
      ) {
        bestPair = pair;
      }
      if (
        !worstPair ||
        pair.ratio < worstPair.ratio ||
        (pair.ratio === worstPair.ratio && pair.shared_count > worstPair.shared_count)
      ) {
        worstPair = pair;
      }
    }
  }

  const stripRatio = (p) => {
    if (!p) return null;
    const { ratio: _r, ...clean } = p;
    return clean;
  };

  return {
    twins: stripRatio(bestPair),
    rivals: stripRatio(worstPair),
  };
}
