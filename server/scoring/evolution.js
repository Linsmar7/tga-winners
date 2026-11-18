import { LEGACY_BASELINE_DATE } from '../db.js';
import { compareRankingEntries, getCategoryWeight, isTiedEntries } from './helpers.js';

/**
 * Constrói a linha do tempo de evolução do ranking ao longo da cerimônia,
 * iniciando no ponto base (17/11/2026) e acumulando cada vencedor/extra decidido.
 */
export function computeEvolutionTimeline({
  orderedCategories,
  winnerByCategoryId,
  decidedSideBets,
  voters,
  votesByVoter,
  sideBetVotesByVoter,
}) {
  if (voters.length === 0) {
    return { voters: [], steps: [] };
  }

  const events = [];
  for (const cat of orderedCategories) {
    const winner = winnerByCategoryId.get(cat.id);
    if (!winner) continue;
    events.push({
      type: 'category',
      id: `cat-${cat.id}`,
      category_id: cat.id,
      label: cat.name,
      winner_name: winner.name,
      weight: getCategoryWeight(cat),
      winner_id: winner.id,
      display_order: cat.display_order || 0,
      decided_at: winner.decided_at || LEGACY_BASELINE_DATE,
    });
  }

  for (const sb of decidedSideBets) {
    events.push({
      type: 'side_bet',
      id: `sb-${sb.id}`,
      side_bet_id: sb.id,
      label: `Extra: ${sb.question}`,
      winner_name: sb.correct_option,
      weight: Number(sb.points) || 3,
      correct_option: sb.correct_option,
      display_order: 1000 + (sb.display_order || 0),
      decided_at: sb.decided_at || LEGACY_BASELINE_DATE,
    });
  }

  events.sort((a, b) => {
    const tA = new Date(a.decided_at).getTime();
    const tB = new Date(b.decided_at).getTime();
    if (!Number.isNaN(tA) && !Number.isNaN(tB) && tA !== tB) return tA - tB;
    return a.display_order - b.display_order;
  });

  const running = new Map();
  for (const v of voters) {
    running.set(v.id, {
      voter_id: v.id,
      nickname: v.nickname,
      total_points: 0,
      will_win_hits: 0,
      want_win_bonus_hits: 0,
      side_bet_hits: 0,
    });
  }

  const snapshotStep = (stepMeta) => {
    const arr = Array.from(running.values()).sort(compareRankingEntries);
    let pos = 1;
    const standings = {};
    arr.forEach((entry, idx) => {
      if (idx > 0 && !isTiedEntries(arr[idx - 1], entry)) {
        pos = idx + 1;
      }
      standings[entry.voter_id] = {
        points: entry.total_points,
        position: pos,
      };
    });
    return {
      ...stepMeta,
      standings,
    };
  };

  const steps = [
    snapshotStep({
      step_index: 0,
      id: 'start',
      label: 'Início (17/11/2026)',
      short_label: 'Início',
      winner_name: null,
      timestamp: LEGACY_BASELINE_DATE,
    }),
  ];

  events.forEach((ev, idx) => {
    for (const v of voters) {
      const state = running.get(v.id);
      if (ev.type === 'category') {
        const vote = votesByVoter.get(v.id)?.get(ev.category_id);
        if (vote) {
          const hitWill = vote.will_win_nominee_id === ev.winner_id;
          const hitWant = vote.want_win_nominee_id === ev.winner_id;
          const bonus = hitWant && vote.want_win_nominee_id !== vote.will_win_nominee_id;
          if (hitWill) {
            state.total_points += ev.weight;
            state.will_win_hits += 1;
          }
          if (bonus) {
            state.total_points += 1;
            state.want_win_bonus_hits += 1;
          }
        }
      } else if (ev.type === 'side_bet') {
        const chosen = sideBetVotesByVoter.get(v.id)?.get(ev.side_bet_id);
        if (chosen && chosen === ev.correct_option) {
          state.total_points += ev.weight;
          state.side_bet_hits += 1;
        }
      }
    }

    steps.push(
      snapshotStep({
        step_index: idx + 1,
        id: ev.id,
        label: ev.label,
        short_label: `#${idx + 1}`,
        winner_name: ev.winner_name,
        timestamp: ev.decided_at,
      })
    );
  });

  const finalSortedVoters = Array.from(running.values())
    .sort(compareRankingEntries)
    .map((v) => ({ voter_id: v.voter_id, nickname: v.nickname }));

  return {
    voters: finalSortedVoters,
    steps,
  };
}
