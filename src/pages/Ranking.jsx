import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy,
  Target,
  Zap,
  Heart,
  Flame,
  Loader2,
  Medal,
  ChevronRight,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import CountdownBadge from '../components/CountdownBadge';
import VoterDetailModal from '../components/VoterDetailModal';
import { apiFetch } from '../lib/api';

export default function Ranking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year');

  const [editions, setEditions] = useState([]);
  const [rankingData, setRankingData] = useState(null);
  const [selectedVoterId, setSelectedVoterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const edListRes = await apiFetch('/api/editions');
      const allEditions = edListRes.editions || [];
      setEditions(allEditions);

      if (allEditions.length === 0) {
        setRankingData(null);
        setLoading(false);
        return;
      }

      let yearToLoad = requestedYear ? Number(requestedYear) : null;
      if (!yearToLoad) {
        const activeRes = await apiFetch('/api/editions/active');
        yearToLoad = activeRes?.edition?.year || allEditions[0].year;
      }

      const data = await apiFetch(`/api/editions/${yearToLoad}/ranking`);
      setRankingData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [requestedYear]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const handleSelectYear = (year) => {
    setSearchParams({ year: String(year) });
  };

  const edition = rankingData?.edition || null;
  const ranking = rankingData?.ranking || [];
  const stats = rankingData?.stats || {};
  const topThree = ranking.slice(0, 3);

  return (
    <div className="min-h-screen bg-zinc-950 pb-16 text-zinc-100">
      <Navbar
        editions={editions}
        selectedYear={edition?.year}
        onSelectYear={handleSelectYear}
      />

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            <p className="mt-3 text-sm">Calculando placar...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
            {error}
          </div>
        ) : !edition ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-400/70" />
            <p className="mt-3 text-sm text-zinc-400">Nenhuma edição encontrada.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Ranking <span className="text-amber-400">{edition.year}</span>
                  </h1>
                  <CountdownBadge edition={edition} />
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {rankingData.decided_categories_count} de {rankingData.categories_count} categorias
                  apuradas
                </p>
              </div>

              <Link
                to={`/?year=${edition.year}`}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-400"
              >
                Ver Categorias
              </Link>
            </div>

            {/* Community Highlights */}
            <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                icon={<Target className="h-4 w-4 text-emerald-400" />}
                label="Barbada do Ano"
                title={stats.barbada ? stats.barbada.winner_name : 'Aguardando apuração'}
                subtitle={
                  stats.barbada
                    ? `${stats.barbada.category_name} · ${stats.barbada.percentage}% acertaram (${stats.barbada.hits}/${stats.barbada.total_votes})`
                    : 'Maior % de acertos em Vai Ganhar'
                }
              />

              <StatCard
                icon={<Zap className="h-4 w-4 text-amber-400" />}
                label="Zebra do Ano"
                title={stats.zebra ? stats.zebra.winner_name : 'Aguardando apuração'}
                subtitle={
                  stats.zebra
                    ? `${stats.zebra.category_name} · ${stats.zebra.percentage}% acertaram (${stats.zebra.hits}/${stats.zebra.total_votes})`
                    : 'Menor % de acertos em Vai Ganhar'
                }
              />

              <StatCard
                icon={<Heart className="h-4 w-4 text-rose-400" />}
                label="Queridinho da Galera"
                title={stats.queridinho ? stats.queridinho.nominee_name : 'Sem votos ainda'}
                subtitle={
                  stats.queridinho
                    ? `${stats.queridinho.category_name} · ${stats.queridinho.votes_count} votos em Quero`
                    : 'Mais votado em Quero que Ganhe'
                }
              />

              <StatCard
                icon={<Flame className="h-4 w-4 text-orange-400" />}
                label="Mais Iludido"
                title={stats.mais_iludido ? stats.mais_iludido.nickname : 'Aguardando apuração'}
                subtitle={
                  stats.mais_iludido
                    ? `${stats.mais_iludido.lost_want_win_count} escolhas "Quero" derrotadas`
                    : 'Mais votos em "Quero" que perderam'
                }
              />
            </section>

            {/* Podium */}
            {topThree.length > 0 && (
              <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {topThree.map((entry, idx) => {
                  const medalStyles = [
                    'border-amber-500/50 bg-amber-500/10 text-amber-400',
                    'border-zinc-500/40 bg-zinc-800/40 text-zinc-200',
                    'border-amber-700/40 bg-amber-900/15 text-amber-600',
                  ][idx];

                  return (
                    <button
                      key={entry.voter_id}
                      type="button"
                      onClick={() => setSelectedVoterId(entry.voter_id)}
                      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition hover:brightness-110 ${medalStyles}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                          <Medal className="h-4 w-4 shrink-0" />
                          <span>#{entry.position} Lugar</span>
                        </div>
                        <p className="mt-1 truncate text-base font-bold text-zinc-100">
                          {entry.nickname}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {entry.will_win_hits} acertos
                          {entry.want_win_bonus_hits > 0 && ` · +${entry.want_win_bonus_hits} zebra`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-zinc-100">
                          {entry.total_points}
                        </span>
                        <span className="block text-[10px] font-semibold uppercase text-zinc-400">
                          pts
                        </span>
                      </div>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Full Ranking Table */}
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
              <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Classificação Geral ({ranking.length})
                </h2>
              </div>

              {ranking.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Nenhum palpite registrado nesta edição ainda.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80">
                  {ranking.map((entry) => (
                    <button
                      key={entry.voter_id}
                      type="button"
                      onClick={() => setSelectedVoterId(entry.voter_id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-800/40 sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            entry.position === 1
                              ? 'bg-amber-500 text-zinc-950'
                              : entry.position === 2
                                ? 'bg-zinc-300 text-zinc-950'
                                : entry.position === 3
                                  ? 'bg-amber-700 text-zinc-100'
                                  : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {entry.position}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {entry.nickname}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {entry.will_win_hits} Vai Ganhar
                            {entry.want_win_bonus_hits > 0 &&
                              ` · ${entry.want_win_bonus_hits} Bônus Zebra`}
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
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <VoterDetailModal
        year={edition?.year}
        voterId={selectedVoterId}
        onClose={() => setSelectedVoterId(null)}
      />
    </div>
  );
}

function StatCard({ icon, label, title, subtitle }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 truncate text-base font-bold text-zinc-100">{title}</p>
      <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>
    </div>
  );
}
