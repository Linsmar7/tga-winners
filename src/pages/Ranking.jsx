import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy,
  Swords,
  BarChart2,
  TrendingUp,
  Sparkles,
  Image as ImageIcon,
  Radio,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import CountdownBadge from '../components/CountdownBadge';
import VoterDetailModal from '../components/VoterDetailModal';
import HeadToHeadModal from '../components/HeadToHeadModal';
import ConsensusView from '../components/ConsensusView';
import RankingEvolutionChart from '../components/RankingEvolutionChart';
import WhatIfSimulator from '../components/WhatIfSimulator';
import ShareCardModal from '../components/ShareCardModal';
import ConfettiCanvas from '../components/ConfettiCanvas';
import { RankingSkeleton } from '../components/Skeletons';
import RankingHighlights from '../components/ranking/RankingHighlights';
import RankingPodium from '../components/ranking/RankingPodium';
import RankingLeaderboard from '../components/ranking/RankingLeaderboard';
import LiveNotificationBanner from '../components/ui/LiveNotificationBanner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { useEditionStream } from '../lib/useEditionStream';
import { isUserEntry } from '../lib/formatters';

const RANKING_TABS = [
  { id: 'leaderboard', label: 'Placar & Destaques', icon: Trophy },
  { id: 'consensus', label: 'Consenso', icon: BarChart2 },
  { id: 'evolution', label: 'Evolução', icon: TrendingUp },
  { id: 'simulator', label: 'Simulador E se...?', icon: Sparkles },
];

export default function Ranking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year');
  const { user } = useAuth();

  const [editions, setEditions] = useState([]);
  const [rankingData, setRankingData] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [selectedVoterId, setSelectedVoterId] = useState(null);
  const [compareState, setCompareState] = useState({ open: false, a: null, b: null });
  const [shareOpen, setShareOpen] = useState(false);
  const [liveToast, setLiveToast] = useState(null);
  const [confettiBurst, setConfettiBurst] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toastTimerRef = useRef(null);
  const myPointsRef = useRef(0);

  const showToast = (msg) => {
    setLiveToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setLiveToast(null), 5500);
  };

  const loadRanking = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        let yearToLoad = requestedYear ? Number(requestedYear) : null;
        if (!yearToLoad) {
          const activeRes = await apiFetch('/api/editions/active');
          setEditions(activeRes?.editions || []);
          if (!activeRes?.edition) {
            setRankingData(null);
            return;
          }
          yearToLoad = activeRes.edition.year;
        }

        const data = await apiFetch(`/api/editions/${yearToLoad}/ranking`);
        if (data?.editions) setEditions(data.editions);
        setRankingData(data);

        if (user && data?.ranking) {
          const me = data.ranking.find((r) => isUserEntry(r, user));
          if (silent && me && me.total_points > myPointsRef.current) {
            setConfettiBurst((b) => b + 1);
          }
          if (me) myPointsRef.current = me.total_points;
        }
      } catch (err) {
        if (!silent) setError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [requestedYear, user]
  );

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const edition = rankingData?.edition || null;
  const ranking = rankingData?.ranking || [];
  const stats = rankingData?.stats || {};
  const topThree = ranking.slice(0, 3);

  const myEntry = useMemo(
    () => (user ? ranking.find((r) => isUserEntry(r, user)) || null : null),
    [ranking, user]
  );

  const { connected: sseConnected } = useEditionStream(edition?.year, {
    onWinnerUpdated: (payload) => {
      loadRanking({ silent: true });
      if (payload?.winner) {
        showToast(`🏆 ${payload.category_name}: ${payload.winner.name} venceu!`);
      }
    },
    onSideBetUpdated: (payload) => {
      loadRanking({ silent: true });
      if (payload?.correct_option) {
        showToast(`🎲 ${payload.question} → ${payload.correct_option}`);
      }
    },
    onEditionUpdated: () => loadRanking({ silent: true }),
  });

  const openCompareWith = (targetVoterId) => {
    setSelectedVoterId(null);
    const defaultA = myEntry?.voter_id || ranking[0]?.voter_id || null;
    const defaultB =
      targetVoterId && targetVoterId !== defaultA
        ? targetVoterId
        : ranking.find((r) => r.voter_id !== defaultA)?.voter_id || defaultA;
    setCompareState({ open: true, a: defaultA, b: defaultB });
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-16 text-zinc-100">
      <ConfettiCanvas burstId={confettiBurst} />
      <Navbar
        editions={editions}
        selectedYear={edition?.year}
        onSelectYear={(year) => setSearchParams({ year: String(year) })}
      />

      <LiveNotificationBanner banner={liveToast} />

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {loading ? (
          <RankingSkeleton />
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
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Ranking <span className="text-amber-400">{edition.year}</span>
                  </h1>
                  <CountdownBadge edition={edition} />
                  {sseConnected && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <Radio className="h-3 w-3 animate-pulse" />
                      Ao vivo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {rankingData.decided_categories_count} de {rankingData.categories_count} categorias
                  apuradas
                  {rankingData.side_bets_count > 0 &&
                    ` · ${rankingData.decided_side_bets_count}/${rankingData.side_bets_count} extras`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ranking.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => openCompareWith(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-300"
                  >
                    <Swords className="h-3.5 w-3.5 text-amber-400" />
                    <span>Comparar</span>
                  </button>
                )}

                {myEntry && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Meu Card</span>
                  </button>
                )}

                <Link
                  to={`/?year=${edition.year}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-400"
                >
                  Ver Categorias
                </Link>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1.5">
              {RANKING_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'leaderboard' && (
              <>
                <RankingHighlights stats={stats} />
                <RankingPodium
                  topThree={topThree}
                  myVoterId={myEntry?.voter_id}
                  onSelectVoter={setSelectedVoterId}
                />
                <RankingLeaderboard
                  ranking={ranking}
                  myVoterId={myEntry?.voter_id}
                  decidedCategoriesCount={rankingData.decided_categories_count}
                  onSelectVoter={setSelectedVoterId}
                />
              </>
            )}

            {activeTab === 'consensus' && (
              <ConsensusView consensus={rankingData.consensus || []} />
            )}

            {activeTab === 'evolution' && (
              <RankingEvolutionChart
                evolution={rankingData.evolution}
                highlightVoterId={myEntry?.voter_id || null}
              />
            )}

            {activeTab === 'simulator' && (
              <WhatIfSimulator
                year={edition.year}
                currentRanking={ranking}
                currentUserId={user?.id || null}
              />
            )}
          </>
        )}
      </main>

      <VoterDetailModal
        year={edition?.year}
        voterId={selectedVoterId}
        onClose={() => setSelectedVoterId(null)}
        canCompare={ranking.length >= 2}
        onCompareWith={openCompareWith}
      />

      <HeadToHeadModal
        open={compareState.open}
        onClose={() => setCompareState((s) => ({ ...s, open: false }))}
        year={edition?.year}
        voters={ranking}
        initialVoterA={compareState.a}
        initialVoterB={compareState.b}
      />

      <ShareCardModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode="ranking"
        year={edition?.year}
        nickname={myEntry?.nickname || user?.username}
        rankingEntry={myEntry}
        totalParticipants={ranking.length}
      />
    </div>
  );
}
