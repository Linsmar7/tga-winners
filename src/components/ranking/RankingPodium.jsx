import React from 'react';
import { Medal } from 'lucide-react';

export default function RankingPodium({ topThree = [], myVoterId, onSelectVoter }) {
  if (topThree.length === 0) return null;

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {topThree.map((entry) => {
        const isMe = myVoterId === entry.voter_id;
        const medalStyles =
          entry.position === 1
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
            : entry.position === 2
              ? 'border-zinc-500/40 bg-zinc-800/40 text-zinc-200'
              : 'border-amber-700/40 bg-amber-900/15 text-amber-600';

        return (
          <button
            key={entry.voter_id}
            type="button"
            onClick={() => onSelectVoter(entry.voter_id)}
            className={`flex items-center justify-between rounded-2xl border p-4 text-left transition hover:brightness-110 ${medalStyles} ${
              isMe ? 'ring-2 ring-amber-400/60' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <Medal className="h-4 w-4 shrink-0" />
                <span>#{entry.position} Lugar</span>
                {isMe && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-zinc-950">
                    VOCÊ
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-base font-bold text-zinc-100">
                {entry.nickname} {entry.hit_goty ? '👑' : ''}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {entry.will_win_hits} acertos
                {entry.want_win_bonus_hits > 0 && ` · +${entry.want_win_bonus_hits} zebra`}
                {entry.side_bet_hits > 0 && ` · +${entry.side_bet_hits} extra`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-zinc-100">{entry.total_points}</span>
              <span className="block text-[10px] font-semibold uppercase text-zinc-400">pts</span>
            </div>
          </button>
        );
      })}
    </section>
  );
}
