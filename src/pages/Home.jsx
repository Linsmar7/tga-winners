import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Check,
  Loader2,
  Save,
  Sparkles,
  Trophy,
  Heart,
  Users,
  AlertCircle,
  Lock,
  LogIn,
  UserCheck,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import CountdownBadge from '../components/CountdownBadge';
import CategoryCard from '../components/CategoryCard';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get('year');
  const { user, loadingAuth } = useAuth();

  const [editions, setEditions] = useState([]);
  const [editionData, setEditionData] = useState(null);
  const [votesMap, setVotesMap] = useState({});
  const [existingVoter, setExistingVoter] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text }

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const edListRes = await apiFetch('/api/editions');
      const allEditions = edListRes.editions || [];
      setEditions(allEditions);

      if (allEditions.length === 0) {
        setEditionData(null);
        setLoading(false);
        return;
      }

      const data = requestedYear
        ? await apiFetch(`/api/editions/${requestedYear}`)
        : await apiFetch('/api/editions/active');

      setEditionData(data);

      if (data?.edition?.year) {
        const myVotesRes = await apiFetch(`/api/editions/${data.edition.year}/my-votes`);
        const serverVotes = myVotesRes.votes || [];
        const draftKey = `tga_draft_${data.edition.year}`;

        if (serverVotes.length > 0) {
          const map = {};
          for (const v of serverVotes) {
            map[v.category_id] = {
              will_win_nominee_id: v.will_win_nominee_id ?? null,
              want_win_nominee_id: v.want_win_nominee_id ?? null,
            };
          }
          setVotesMap(map);
        } else {
          try {
            const rawDraft = sessionStorage.getItem(draftKey);
            setVotesMap(rawDraft ? JSON.parse(rawDraft) : {});
          } catch {
            setVotesMap({});
          }
        }

        setExistingVoter(myVotesRes.voter || null);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [requestedYear, user?.id]);

  useEffect(() => {
    if (!loadingAuth) {
      loadData();
    }
  }, [loadingAuth, loadData]);

  const handleSelectYear = (year) => {
    setSearchParams({ year: String(year) });
  };

  const edition = editionData?.edition || null;
  const categories = editionData?.categories || [];
  const summary = editionData?.summary || { total_voters: 0, total_categories: 0 };

  const persistDraft = (year, nextMap) => {
    if (!year) return;
    try {
      sessionStorage.setItem(`tga_draft_${year}`, JSON.stringify(nextMap));
    } catch {
      // ignore storage errors
    }
  };

  const now = Date.now();
  const isBeforeStart = edition ? now < new Date(edition.voting_start).getTime() : false;
  const isAfterEnd = edition ? now >= new Date(edition.voting_end).getTime() : false;
  const isVotingOpen = Boolean(edition && !isBeforeStart && !isAfterEnd);

  const handleSelectWillWin = (categoryId, nomineeId) => {
    setVotesMap((prev) => {
      const next = {
        ...prev,
        [categoryId]: {
          will_win_nominee_id: nomineeId,
          want_win_nominee_id: prev[categoryId]?.want_win_nominee_id ?? null,
        },
      };
      persistDraft(edition?.year, next);
      return next;
    });
  };

  const handleSelectWantWin = (categoryId, nomineeId) => {
    setVotesMap((prev) => {
      const next = {
        ...prev,
        [categoryId]: {
          will_win_nominee_id: prev[categoryId]?.will_win_nominee_id ?? null,
          want_win_nominee_id: nomineeId,
        },
      };
      persistDraft(edition?.year, next);
      return next;
    });
  };

  const filledCount = useMemo(() => {
    return categories.filter((c) => {
      const v = votesMap[c.id];
      return v && (v.will_win_nominee_id != null || v.want_win_nominee_id != null);
    }).length;
  }, [categories, votesMap]);

  const visibleCategories = useMemo(() => {
    if (filterMode === 'pending') {
      return categories.filter((c) => {
        const v = votesMap[c.id];
        return !v || v.will_win_nominee_id == null || v.want_win_nominee_id == null;
      });
    }
    return categories;
  }, [categories, votesMap, filterMode]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!edition || !isVotingOpen || !user) return;

    setSaving(true);
    setFeedback(null);

    const payloadVotes = Object.entries(votesMap)
      .map(([catId, v]) => ({
        category_id: Number(catId),
        will_win_nominee_id: v.will_win_nominee_id ?? null,
        want_win_nominee_id: v.want_win_nominee_id ?? null,
      }))
      .filter((v) => v.will_win_nominee_id !== null || v.want_win_nominee_id !== null);

    try {
      const res = await apiFetch(`/api/editions/${edition.year}/votes`, {
        method: 'POST',
        body: { votes: payloadVotes },
      });

      setExistingVoter(res.voter);
      try {
        sessionStorage.removeItem(`tga_draft_${edition.year}`);
      } catch {
        // ignore
      }
      setFeedback({ type: 'success', text: 'Palpites salvos!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const redirectBack = edition ? `/?year=${edition.year}` : '/';

  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-zinc-100">
      <Navbar
        editions={editions}
        selectedYear={edition?.year}
        onSelectYear={handleSelectYear}
      />

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
            <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            <p className="mt-3 text-sm">Carregando edição...</p>
          </div>
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
            {/* Compact Edition Header */}
            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
                    TGA <span className="text-amber-400">{edition.year}</span>
                  </h1>
                  <CountdownBadge edition={edition} />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    Vai Ganhar: <strong className="text-zinc-200">+5 pts</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    Quero (zebra): <strong className="text-zinc-200">+1 pt</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-zinc-400" />
                    <strong className="text-zinc-200">{summary.total_voters}</strong> participantes
                  </span>
                </div>
              </div>

              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 self-start rounded-xl border border-zinc-800 bg-zinc-950 p-1 sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      filterMode === 'all'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Todas ({categories.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('pending')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      filterMode === 'pending'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Pendentes ({categories.length - filledCount})
                  </button>
                </div>
              )}
            </div>

            {existingVoter && (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                  Palpites carregados para <strong>{existingVoter.nickname}</strong>.
                  {isVotingOpen ? ' Você pode editar e salvar novamente.' : ' Votação travada.'}
                </span>
              </div>
            )}

            {visibleCategories.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
                {filterMode === 'pending'
                  ? 'Todas as categorias já possuem palpites!'
                  : 'Nenhuma categoria cadastrada nesta edição ainda.'}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleCategories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    vote={votesMap[cat.id]}
                    disabled={!isVotingOpen}
                    onSelectWillWin={handleSelectWillWin}
                    onSelectWantWin={handleSelectWantWin}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Action Bar */}
      {edition && categories.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
          <div className="mx-auto max-w-4xl px-4 py-3">
            {feedback && (
              <div
                className={`mb-2.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : feedback.type === 'info'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {isVotingOpen ? (
              user ? (
                <form
                  onSubmit={handleSave}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center justify-between gap-3 sm:justify-start">
                    <div className="text-xs text-zinc-400">
                      <span className="font-bold text-amber-400">{filledCount}</span>/
                      {categories.length} categorias preenchidas
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <strong className="text-zinc-200">{user.username}</strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>Salvar Palpites</span>
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-400">
                    <span className="font-bold text-amber-400">{filledCount}</span>/
                    {categories.length} selecionadas · Entre ou crie uma conta para salvar
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/entrar?mode=register&redirect=${encodeURIComponent(redirectBack)}`}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40"
                    >
                      Criar conta
                    </Link>
                    <Link
                      to={`/entrar?redirect=${encodeURIComponent(redirectBack)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Entrar para salvar</span>
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-zinc-500" />
                  {isBeforeStart
                    ? 'Votação ainda não iniciada.'
                    : 'Votação encerrada. Modo somente leitura.'}
                </span>
                <Link
                  to={`/ranking?year=${edition.year}`}
                  className="rounded-lg bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-400 transition hover:bg-amber-500/25"
                >
                  Ver Ranking →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
