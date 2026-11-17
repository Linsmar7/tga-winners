/**
 * Calcula pontuação, ranking e estatísticas da comunidade para uma edição.
 *
 * Regras de pontuação (Seção 5.3):
 * - Acerto em "Vai Ganhar" (will_win_nominee_id === winner.id): +5 pontos
 * - Bônus de Zebra em "Quero que Ganhe": +1 ponto SE want_win_nominee_id === winner.id
 *   E want_win_nominee_id !== will_win_nominee_id (anti-exploração)
 */
export function computeRankingAndStats({ categories, nominees, voters, votes }) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order || a.id - b.id
  );

  const nomineesById = new Map();
  const winnerByCategoryId = new Map();

  for (const nominee of nominees) {
    nomineesById.set(nominee.id, nominee);
    if (nominee.is_winner) {
      winnerByCategoryId.set(nominee.category_id, nominee);
    }
  }

  // Agrupa votos por voter_id -> Map<category_id, vote>
  const votesByVoter = new Map();
  // Contagem global de "Quero que Ganhe" por nominee_id
  const wantWinCountsByNominee = new Map();
  // Contagem por categoria de acertos/total em "Vai Ganhar"
  const categoryStatsMap = new Map();

  for (const cat of orderedCategories) {
    categoryStatsMap.set(cat.id, {
      category_id: cat.id,
      category_name: cat.name,
      display_order: cat.display_order,
      winner: winnerByCategoryId.get(cat.id) || null,
      will_win_total: 0,
      will_win_hits: 0,
    });
  }

  for (const vote of votes) {
    if (!votesByVoter.has(vote.voter_id)) {
      votesByVoter.set(vote.voter_id, new Map());
    }
    votesByVoter.get(vote.voter_id).set(vote.category_id, vote);

    if (vote.want_win_nominee_id != null && nomineesById.has(vote.want_win_nominee_id)) {
      wantWinCountsByNominee.set(
        vote.want_win_nominee_id,
        (wantWinCountsByNominee.get(vote.want_win_nominee_id) || 0) + 1
      );
    }

    const catStat = categoryStatsMap.get(vote.category_id);
    if (catStat && vote.will_win_nominee_id != null && nomineesById.has(vote.will_win_nominee_id)) {
      catStat.will_win_total += 1;
      if (catStat.winner && vote.will_win_nominee_id === catStat.winner.id) {
        catStat.will_win_hits += 1;
      }
    }
  }

  const rankingEntries = voters.map((voter) => {
    const voterVotes = votesByVoter.get(voter.id) || new Map();
    let totalPoints = 0;
    let willWinHits = 0;
    let wantWinBonusHits = 0;
    let deludedCount = 0;
    let filledCategories = 0;

    for (const cat of orderedCategories) {
      const vote = voterVotes.get(cat.id);
      if (!vote) continue;

      if (vote.will_win_nominee_id != null || vote.want_win_nominee_id != null) {
        filledCategories += 1;
      }

      const winner = winnerByCategoryId.get(cat.id);
      if (!winner) continue;

      const hitWillWin = vote.will_win_nominee_id === winner.id;
      const hitWantWin = vote.want_win_nominee_id === winner.id;
      const isUpsetBonus = hitWantWin && vote.want_win_nominee_id !== vote.will_win_nominee_id;

      if (hitWillWin) {
        totalPoints += 5;
        willWinHits += 1;
      }
      if (isUpsetBonus) {
        totalPoints += 1;
        wantWinBonusHits += 1;
      }

      if (vote.want_win_nominee_id != null && vote.want_win_nominee_id !== winner.id) {
        deludedCount += 1;
      }
    }

    return {
      voter_id: voter.id,
      nickname: voter.nickname,
      total_points: totalPoints,
      will_win_hits: willWinHits,
      want_win_bonus_hits: wantWinBonusHits,
      deluded_count: deludedCount,
      filled_categories: filledCategories,
    };
  });

  rankingEntries.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.will_win_hits !== a.will_win_hits) return b.will_win_hits - a.will_win_hits;
    if (b.want_win_bonus_hits !== a.want_win_bonus_hits) {
      return b.want_win_bonus_hits - a.want_win_bonus_hits;
    }
    return a.nickname.localeCompare(b.nickname, 'pt-BR');
  });

  const ranking = rankingEntries.map((entry, idx) => ({
    position: idx + 1,
    ...entry,
  }));

  // Destaques da Galera
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

  let maisIludido = null;
  if (winnerByCategoryId.size > 0 && rankingEntries.length > 0) {
    const sortedDeluded = [...rankingEntries]
      .filter((r) => r.deluded_count > 0)
      .sort((a, b) => b.deluded_count - a.deluded_count || a.nickname.localeCompare(b.nickname, 'pt-BR'));

    if (sortedDeluded.length > 0) {
      maisIludido = {
        voter_id: sortedDeluded[0].voter_id,
        nickname: sortedDeluded[0].nickname,
        lost_want_win_count: sortedDeluded[0].deluded_count,
      };
    }
  }

  return {
    ranking,
    stats: {
      barbada,
      zebra,
      queridinho,
      mais_iludido: maisIludido,
    },
    decided_categories_count: winnerByCategoryId.size,
    categories_count: orderedCategories.length,
  };
}

/**
 * Monta o detalhe completo dos palpites de um participante específico.
 */
export function buildVoterDetails({ voter, categories, nominees, votes }) {
  const orderedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order || a.id - b.id
  );
  const nomineesById = new Map(nominees.map((n) => [n.id, n]));
  const winnerByCategoryId = new Map();
  for (const n of nominees) {
    if (n.is_winner) winnerByCategoryId.set(n.category_id, n);
  }
  const voteByCategoryId = new Map(votes.map((v) => [v.category_id, v]));

  let totalPoints = 0;
  let willWinHits = 0;
  let wantWinBonusHits = 0;

  const details = orderedCategories.map((cat) => {
    const vote = voteByCategoryId.get(cat.id) || null;
    const winner = winnerByCategoryId.get(cat.id) || null;
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
        wantWinCorrect && wantWinNominee && (!willWinNominee || wantWinNominee.id !== willWinNominee.id)
      );

      if (willWinCorrect) {
        points += 5;
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
      winner: winner ? { id: winner.id, name: winner.name, image_url: winner.image_url } : null,
      will_win: willWinNominee
        ? { id: willWinNominee.id, name: willWinNominee.name, image_url: willWinNominee.image_url }
        : null,
      want_win: wantWinNominee
        ? { id: wantWinNominee.id, name: wantWinNominee.name, image_url: wantWinNominee.image_url }
        : null,
      will_win_correct: willWinCorrect,
      want_win_correct: wantWinCorrect,
      upset_bonus: upsetBonus,
      points,
    };
  });

  return {
    voter: {
      id: voter.id,
      nickname: voter.nickname,
      total_points: totalPoints,
      will_win_hits: willWinHits,
      want_win_bonus_hits: wantWinBonusHits,
    },
    categories: details,
  };
}
