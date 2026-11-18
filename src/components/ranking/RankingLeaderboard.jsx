import React from 'react';
import { ChevronRight } from 'lucide-react';
import PositionBadge from '../ui/PositionBadge';

export default function RankingLeaderboard({
  ranking = [],
  myVoterId,
  decidedCategoriesCount = 0,
  onSelectVoter,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-200">
          Classificação Geral ({ranking.length})
        </h2>
        <span className="text-[11px] text-zinc-500">Clique em um amigo para ver os palpites</span>
      </div>

      {ranking.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-500">
          Nenhum palpite registrado nesta edição ainda.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80">
          {ranking.map((entry) => {
            const isMe = myVoterId === entry.voter_id;
            return (
              <button
                key={entry.voter_id}
                type="button"
                onClick={() => onSelectVoter(entry.voter_id)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-800/40 sm:px-5 ${
                  isMe ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/35' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PositionBadge position={entry.position} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {entry.nickname}
                      </p>
                      {isMe && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                          Você
                        </span>
                      )}
                      {(entry.badges || []).map((b) => (
                        <span
                          key={b.id}
                          title={b.label}
                          className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] text-zinc-200"
                        >
                          {b.icon}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400">
                      {entry.will_win_hits} Vai Ganhar
                      {entry.want_win_bonus_hits > 0 && ` · ${entry.want_win_bonus_hits} Zebra`}
                      {entry.side_bet_hits > 0 && ` · ${entry.side_bet_hits} Extra`}
                      {decidedCategoriesCount > 0 && ` · ${entry.accuracy_pct}%`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-lg bg-zinc-950 px-2.5 py-1 text-sm font-bold text-amber-400 ring-1 ring-zinc-800">
                    {entry.total_points} pts
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
