import React, { useEffect, useState } from 'react';
import { X, Trophy, Heart, Award, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function VoterDetailModal({ year, voterId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!voterId || !year) return;
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch(`/api/editions/${year}/voters/${voterId}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [year, voterId]);

  if (!voterId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-zinc-100">
              {data?.voter?.nickname || 'Palpites do Participante'}
            </h3>
            {data?.voter && (
              <p className="mt-0.5 text-xs text-zinc-400">
                <span className="font-semibold text-amber-400">{data.voter.total_points} pts</span>
                {' · '}
                {data.voter.will_win_hits} acertos em Vai Ganhar
                {data.voter.want_win_bonus_hits > 0 &&
                  ` · ${data.voter.want_win_bonus_hits} bônus zebra`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-400">{error}</p>
          ) : (
            <div className="space-y-3">
              {data.categories.map((item) => (
                <div
                  key={item.category_id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {item.category_name}
                    </span>
                    {item.winner ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          item.points > 0
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        +{item.points} pts
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-600">Aguardando</span>
                    )}
                  </div>

                  {item.winner && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
                      <Award className="h-3.5 w-3.5 shrink-0" />
                      <span>Vencedor: {item.winner.name}</span>
                    </div>
                  )}

                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                        item.will_win_correct === true
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : item.will_win_correct === false
                            ? 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                            : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">
                        {item.will_win ? item.will_win.name : '—'}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                        item.upset_bonus
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : item.want_win_correct === false
                            ? 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                            : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                      }`}
                    >
                      <Heart className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="truncate">
                        {item.want_win ? item.want_win.name : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
