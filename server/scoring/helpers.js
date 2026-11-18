export function isGotyCategory(name) {
  const n = String(name || '').toLowerCase();
  return n.includes('game of the year') || n === 'goty' || n.includes('jogo do ano');
}

export function getCategoryWeight(cat) {
  const w = Number(cat?.points_weight);
  return Number.isFinite(w) && w > 0 ? w : 5;
}

export function compareRankingEntries(a, b) {
  if (b.total_points !== a.total_points) return b.total_points - a.total_points;
  if (b.will_win_hits !== a.will_win_hits) return b.will_win_hits - a.will_win_hits;
  if (b.want_win_bonus_hits !== a.want_win_bonus_hits) {
    return b.want_win_bonus_hits - a.want_win_bonus_hits;
  }
  if ((b.side_bet_hits || 0) !== (a.side_bet_hits || 0)) {
    return (b.side_bet_hits || 0) - (a.side_bet_hits || 0);
  }
  return a.nickname.localeCompare(b.nickname, 'pt-BR');
}

export function isTiedEntries(a, b) {
  return (
    a.total_points === b.total_points &&
    a.will_win_hits === b.will_win_hits &&
    a.want_win_bonus_hits === b.want_win_bonus_hits &&
    (a.side_bet_hits || 0) === (b.side_bet_hits || 0)
  );
}

/**
 * Ordena entradas de ranking e atribui posições com empates reais (#1, #1, #3).
 */
export function assignPositionsWithTies(entries) {
  const sorted = [...entries].sort(compareRankingEntries);
  let currentPosition = 1;
  return sorted.map((entry, idx) => {
    if (idx > 0 && !isTiedEntries(sorted[idx - 1], entry)) {
      currentPosition = idx + 1;
    }
    return {
      position: currentPosition,
      ...entry,
    };
  });
}
