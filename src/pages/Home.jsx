import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Sparkles, Trophy } from 'lucide-react';
import Navbar from '../components/Navbar';
import CategoryCard from '../components/CategoryCard';
import SideBetsSection from '../components/SideBetsSection';
import ShareCardModal from '../components/ShareCardModal';
import ConfettiCanvas from '../components/ConfettiCanvas';
import { HomeSkeleton } from '../components/Skeletons';
import EditionHeader from '../components/home/EditionHeader';
import CategoryToolbar from '../components/home/CategoryToolbar';
import FocusCategoryCarousel from '../components/home/FocusCategoryCarousel';
import VotingBottomBar from '../components/home/VotingBottomBar';
import LiveNotificationBanner from '../components/ui/LiveNotificationBanner';
import { useAuth } from '../lib/AuthContext';
import { useEditionVoting } from '../lib/useEditionVoting';
import { useEditionStream } from '../lib/useEditionStream';
import { formatPicksForClipboard } from '../lib/formatters';

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year');
  const { user, loadingAuth } = useAuth();

  const {
    editions,
    edition,
    categories,
    sideBets,
    summary,
    votesMap,
    sideBetVotesMap,
    votesMapRef,
    sideBetVotesRef,
    existingVoter,
    isBeforeStart,
    isVotingOpen,
    isDirty,
    autoSaveEnabled,
    autoSaveStatus,
    toggleAutoSave,
    loading,
    saving,
    feedback,
    setFeedback,
    counts,
    loadData,
    saveVotesToServer,
    selectWillWin,
    selectWantWin,
    selectBoth,
    selectSideBet,
    chaosFill,
  } = useEditionVoting({ requestedYear, user, loadingAuth });

  const [sectionTab, setSectionTab] = useState('categories'); // 'categories' | 'side_bets'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending' | 'complete' | 'partial' | 'empty'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'focus'
  const [copiedText, setCopiedText] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [liveBanner, setLiveBanner] = useState(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const liveBannerTimerRef = useRef(null);

  const showLiveBanner = (bannerPayload) => {
    setLiveBanner(bannerPayload);
    clearTimeout(liveBannerTimerRef.current);
    liveBannerTimerRef.current = setTimeout(() => setLiveBanner(null), 6500);
  };

  useEditionStream(edition?.year, {
    onWinnerUpdated: (payload) => {
      loadData({ silent: true });
      if (!payload?.winner) return;
      const myVote = votesMapRef.current[payload.category_id];
      const hitWill = myVote?.will_win_nominee_id === payload.winner.id;
      const hitBonus =
        myVote?.want_win_nominee_id === payload.winner.id &&
        myVote?.want_win_nominee_id !== myVote?.will_win_nominee_id;

      if (hitWill || hitBonus) {
        setConfettiBurst((b) => b + 1);
      }

      showLiveBanner({
        title: `${payload.category_name}: ${payload.winner.name} venceu!`,
        subtitle: hitWill
          ? `🎉 Você cravou (+${payload.points_weight || 5} pts)!`
          : hitBonus
            ? '🔥 Você acertou a Zebra (+1 pt)!'
            : 'Placar atualizado ao vivo.',
        celebrate: hitWill || hitBonus,
      });
    },
    onSideBetUpdated: (payload) => {
      loadData({ silent: true });
      if (!payload?.correct_option) return;
      const myChoice = sideBetVotesRef.current[payload.side_bet_id];
      const hit = myChoice === payload.correct_option;
      if (hit) setConfettiBurst((b) => b + 1);
      showLiveBanner({
        title: `Extra apurado: ${payload.question}`,
        subtitle: hit
          ? `🎲 Você acertou "${payload.correct_option}" (+${payload.points} pts)!`
          : `Resultado oficial: ${payload.correct_option}`,
        celebrate: hit,
      });
    },
    onEditionUpdated: () => loadData({ silent: true }),
  });

  const visibleCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories.filter((c) => {
      const v = votesMap[c.id];
      const hasWill = v?.will_win_nominee_id != null;
      const hasWant = v?.want_win_nominee_id != null;
      const isComplete = hasWill && hasWant;
      const isPartial = (hasWill || hasWant) && !isComplete;
      const isEmpty = !hasWill && !hasWant;

      if (filterMode === 'pending' && isComplete) return false;
      if (filterMode === 'complete' && !isComplete) return false;
      if (filterMode === 'partial' && !isPartial) return false;
      if (filterMode === 'empty' && !isEmpty) return false;

      if (q) {
        const matchCat = c.name.toLowerCase().includes(q);
        const matchNom = c.nominees.some(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            (n.description && n.description.toLowerCase().includes(q))
        );
        if (!matchCat && !matchNom) return false;
      }

      return true;
    });
  }, [categories, votesMap, filterMode, searchQuery]);

  const picksForShareCard = useMemo(
    () =>
      categories
        .map((cat) => {
          const v = votesMap[cat.id];
          if (!v || (v.will_win_nominee_id == null && v.want_win_nominee_id == null)) return null;
          return {
            categoryName: cat.name,
            willWinName: cat.nominees.find((n) => n.id === v.will_win_nominee_id)?.name || null,
            wantWinName: cat.nominees.find((n) => n.id === v.want_win_nominee_id)?.name || null,
          };
        })
        .filter(Boolean),
    [categories, votesMap]
  );

  const handleCopyPicksText = async () => {
    if (!edition) return;
    const text = formatPicksForClipboard({
      year: edition.year,
      username: user?.username,
      categories,
      votesMap,
      sideBets,
      sideBetVotesMap,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      setFeedback({
        type: 'error',
        text: 'Não foi possível copiar para a área de transferência.',
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await saveVotesToServer({ isAuto: false });
  };

  const filledSideBetsCount = sideBets.filter((sb) => Boolean(sideBetVotesMap[sb.id])).length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-36 text-zinc-100">
      <ConfettiCanvas burstId={confettiBurst} />
      <Navbar
        editions={editions}
        selectedYear={edition?.year}
        onSelectYear={(year) => setSearchParams({ year: String(year) })}
      />

      <LiveNotificationBanner banner={liveBanner} />

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {loading ? (
          <HomeSkeleton />
        ) : !edition ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-400/70" />
            <h1 className="mt-3 text-lg font-bold text-zinc-100">Nenhuma edição cadastrada</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Configure a primeira edição no painel administrativo.
            </p>
            <Link
              to="/admin"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              Ir para Admin
            </Link>
          </div>
        ) : (
          <>
            <EditionHeader
              edition={edition}
              summary={summary}
              counts={counts}
              sideBetsCount={sideBets.length}
              filledSideBetsCount={filledSideBetsCount}
              isVotingOpen={isVotingOpen}
              copiedText={copiedText}
              onCopyPicks={handleCopyPicksText}
              onOpenShareCard={() => setShareOpen(true)}
              onChaosFill={chaosFill}
              sectionTab={sectionTab}
              onChangeSectionTab={setSectionTab}
            />

            {sectionTab === 'categories' && categories.length > 0 && (
              <>
                <CategoryToolbar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filterMode={filterMode}
                  onFilterModeChange={setFilterMode}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  counts={counts}
                />

                {existingVoter && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                      Palpites carregados para <strong>{existingVoter.nickname}</strong>.
                      {isVotingOpen
                        ? ' Clique duplo em um indicado marca Vai Ganhar + Quero.'
                        : ' Votação travada.'}
                    </span>
                  </div>
                )}

                {visibleCategories.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
                    {searchQuery
                      ? 'Nenhuma categoria ou indicado corresponde à sua busca.'
                      : filterMode === 'pending'
                        ? 'Todas as categorias estão 100% completas!'
                        : 'Nenhuma categoria encontrada neste filtro.'}
                  </div>
                ) : viewMode === 'focus' ? (
                  <FocusCategoryCarousel
                    categories={visibleCategories}
                    votesMap={votesMap}
                    disabled={!isVotingOpen}
                    onSelectWillWin={selectWillWin}
                    onSelectWantWin={selectWantWin}
                    onSelectBoth={selectBoth}
                  />
                ) : (
                  <div className="space-y-4">
                    {visibleCategories.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        vote={votesMap[cat.id]}
                        disabled={!isVotingOpen}
                        onSelectWillWin={selectWillWin}
                        onSelectWantWin={selectWantWin}
                        onSelectBoth={selectBoth}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {sectionTab === 'side_bets' && (
              <SideBetsSection
                sideBets={sideBets}
                votesMap={sideBetVotesMap}
                disabled={!isVotingOpen}
                onSelectOption={selectSideBet}
              />
            )}
          </>
        )}
      </main>

      {edition && (categories.length > 0 || sideBets.length > 0) && (
        <VotingBottomBar
          edition={edition}
          counts={counts}
          user={user}
          isVotingOpen={isVotingOpen}
          isBeforeStart={isBeforeStart}
          isDirty={isDirty}
          autoSaveEnabled={autoSaveEnabled}
          autoSaveStatus={autoSaveStatus}
          onToggleAutoSave={toggleAutoSave}
          saving={saving}
          onSave={handleSave}
          feedback={feedback}
        />
      )}

      <ShareCardModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode="picks"
        year={edition?.year}
        nickname={user?.username || existingVoter?.nickname || 'Meus Palpites'}
        picks={picksForShareCard}
      />
    </div>
  );
}
