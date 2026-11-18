import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Crown, Loader2, Medal, Trophy } from 'lucide-react';
import Navbar from '../components/Navbar';
import PositionBadge from '../components/ui/PositionBadge';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { isUserEntry } from '../lib/formatters';

export default function History() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/history')
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const championsByYear = data?.champions_by_year || [];
  const leaderboard = data?.leaderboard || [];

  return (
    <div className="min-h-screen bg-zinc-950 pb-16 text-zinc-100">
      <Navbar editions={data?.editions || []} />

      <main className="mx-auto max-w-4xl px-4 pt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <Crown className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Hall da <span className="text-amber-400">Fama</span>
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Campeões de cada edição e ranking histórico acumulado de todos os anos
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            <p className="mt-3 text-xs">Carregando histórico...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Campeões por Edição
              </h2>
              {championsByYear.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">
                  Nenhuma edição registrada ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {championsByYear.map((ed) => (
                    <Link
                      key={ed.edition_id}
                      to={`/ranking?year=${ed.year}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-amber-500/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-amber-400">TGA {ed.year}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ed.is_finished
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {ed.is_finished ? 'Finalizada' : 'Em andamento'}
                        </span>
                      </div>

                      {ed.champions.length > 0 ? (
                        <div className="mt-3">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                            <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                            <span className="truncate">
                              {ed.champions.map((c) => c.nickname).join(' & ')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {ed.champions[0].total_points} pts · {ed.champions[0].will_win_hits}{' '}
                            acertos
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-zinc-500">
                          Aguardando apuração ({ed.voters_count} participantes)
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
              <div className="border-b border-zinc-800 px-5 py-3.5">
                <h2 className="text-sm font-bold text-zinc-100">
                  Ranking Geral Acumulado ({leaderboard.length})
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Clique em um jogador para ver o desempenho ano a ano
                </p>
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Nenhum participante registrado ainda.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80">
                  {leaderboard.map((player) => {
                    const isExpanded = expandedKey === player.key;
                    const isMe = isUserEntry(player, user);

                    return (
                      <div key={player.key}>
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isExpanded ? null : player.key)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-800/40 sm:px-5 ${
                            isMe ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <PositionBadge position={player.position} />

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-bold text-zinc-100">
                                  {player.nickname}
                                </span>
                                {player.titles > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                    <Crown className="h-3 w-3" />
                                    {player.titles}× campeão
                                  </span>
                                )}
                                {isMe && (
                                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                    Você
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400">
                                {player.editions_played}{' '}
                                {player.editions_played === 1 ? 'edição' : 'edições'} ·{' '}
                                {player.podiums} pódios · média {player.avg_accuracy_pct}%
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-lg bg-zinc-950 px-2.5 py-1 text-sm font-bold text-amber-400 ring-1 ring-zinc-800">
                              {player.total_points} pts
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-500" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-zinc-800/70 bg-zinc-950/60 px-5 py-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {player.editions.map((ed) => (
                                <Link
                                  key={ed.year}
                                  to={`/ranking?year=${ed.year}`}
                                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-xs transition hover:border-amber-500/40"
                                >
                                  <div>
                                    <span className="font-bold text-zinc-100">
                                      TGA {ed.year} {ed.hit_goty ? '👑' : ''}
                                    </span>
                                    <p className="text-[11px] text-zinc-400">
                                      {ed.will_win_hits} acertos · {ed.accuracy_pct}%
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                                      {ed.position && <Medal className="h-3.5 w-3.5" />}
                                      {ed.position ? `#${ed.position}` : '—'}
                                    </span>
                                    <span className="block text-[11px] text-zinc-300">
                                      {ed.total_points} pts
                                    </span>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
