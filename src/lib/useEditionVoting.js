import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import { serializeVoteState } from './formatters';
import { useVotingWindow } from './useVotingWindow';

export function useEditionVoting({ requestedYear, user, loadingAuth }) {
  const [editions, setEditions] = useState([]);
  const [editionData, setEditionData] = useState(null);
  const [votesMap, setVotesMap] = useState({});
  const [sideBetVotesMap, setSideBetVotesMap] = useState({});
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [existingVoter, setExistingVoter] = useState(null);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try {
      return localStorage.getItem('tga_autosave') !== 'false';
    } catch {
      return true;
    }
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const votesMapRef = useRef(votesMap);
  votesMapRef.current = votesMap;
  const sideBetVotesRef = useRef(sideBetVotesMap);
  sideBetVotesRef.current = sideBetVotesMap;

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setFeedback(null);
      }
      try {
        const editionUrl = requestedYear
          ? `/api/editions/${requestedYear}`
          : '/api/editions/active';

        let data;
        let myVotesRes = null;
        if (requestedYear) {
          const [edData, mvRes] = await Promise.all([
            apiFetch(editionUrl),
            apiFetch(`/api/editions/${requestedYear}/my-votes`),
          ]);
          data = edData;
          myVotesRes = mvRes;
        } else {
          data = await apiFetch(editionUrl);
          if (data?.edition?.year) {
            myVotesRes = await apiFetch(`/api/editions/${data.edition.year}/my-votes`);
          }
        }

        setEditions(data?.editions || []);
        if (!data?.edition) {
          setEditionData(null);
          return;
        }

        setEditionData(data);

        if (myVotesRes && !silent) {
          const serverVotes = myVotesRes.votes || [];
          const serverSbVotes = myVotesRes.side_bet_votes || [];
          const draftKey = `tga_draft_${data.edition.year}`;

          const serverMap = {};
          for (const v of serverVotes) {
            serverMap[v.category_id] = {
              will_win_nominee_id: v.will_win_nominee_id ?? null,
              want_win_nominee_id: v.want_win_nominee_id ?? null,
            };
          }

          const serverSbMap = {};
          for (const sv of serverSbVotes) {
            serverSbMap[sv.side_bet_id] = sv.selected_option;
          }

          setSavedSnapshot(serializeVoteState(serverMap, serverSbMap));

          let initialVotes = serverMap;
          let initialSb = serverSbMap;
          try {
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) {
              const parsed = JSON.parse(rawDraft);
              if (parsed && typeof parsed === 'object') {
                if (parsed.votes || parsed.sideBets) {
                  if (serverVotes.length === 0 && parsed.votes) initialVotes = parsed.votes;
                  if (serverSbVotes.length === 0 && parsed.sideBets) initialSb = parsed.sideBets;
                } else if (serverVotes.length === 0) {
                  initialVotes = parsed;
                }
              }
            }
          } catch {
            // ignore storage errors
          }

          setVotesMap(initialVotes);
          setSideBetVotesMap(initialSb);
          setExistingVoter(myVotesRes.voter || null);
        }
      } catch (err) {
        if (!silent) setFeedback({ type: 'error', text: err.message });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [requestedYear, user?.id]
  );

  useEffect(() => {
    if (!loadingAuth) {
      loadData();
    }
  }, [loadingAuth, loadData]);

  const edition = editionData?.edition || null;
  const categories = editionData?.categories || [];
  const sideBets = editionData?.side_bets || [];
  const summary = editionData?.summary || { total_voters: 0, total_categories: 0 };

  const { isBeforeStart, isAfterEnd, isVotingOpen } = useVotingWindow(edition);

  const persistDraft = useCallback((year, nextVotes, nextSideBets) => {
    if (!year) return;
    try {
      localStorage.setItem(
        `tga_draft_${year}`,
        JSON.stringify({ votes: nextVotes, sideBets: nextSideBets })
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  const currentSnapshot = useMemo(
    () => serializeVoteState(votesMap, sideBetVotesMap),
    [votesMap, sideBetVotesMap]
  );
  const isDirty = Boolean(edition && isVotingOpen && currentSnapshot !== savedSnapshot);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const saveVotesToServer = useCallback(
    async ({ isAuto = false } = {}) => {
      if (!edition || !isVotingOpen || !user) return;

      if (isAuto) setAutoSaveStatus('saving');
      else {
        setSaving(true);
        setFeedback(null);
      }

      const currentVotes = votesMapRef.current;
      const currentSb = sideBetVotesRef.current;

      const payloadVotes = Object.entries(currentVotes)
        .map(([catId, v]) => ({
          category_id: Number(catId),
          will_win_nominee_id: v.will_win_nominee_id ?? null,
          want_win_nominee_id: v.want_win_nominee_id ?? null,
        }))
        .filter((v) => v.will_win_nominee_id !== null || v.want_win_nominee_id !== null);

      const payloadSideBets = Object.entries(currentSb)
        .filter(([, opt]) => Boolean(opt))
        .map(([sbId, opt]) => ({
          side_bet_id: Number(sbId),
          selected_option: opt,
        }));

      try {
        const res = await apiFetch(`/api/editions/${edition.year}/votes`, {
          method: 'POST',
          body: { votes: payloadVotes, side_bet_votes: payloadSideBets },
        });

        setExistingVoter(res.voter);
        setSavedSnapshot(serializeVoteState(currentVotes, currentSb));
        try {
          localStorage.removeItem(`tga_draft_${edition.year}`);
        } catch {
          // ignore
        }

        if (isAuto) {
          setAutoSaveStatus('saved');
        } else {
          setFeedback({ type: 'success', text: 'Palpites salvos com sucesso!' });
        }
      } catch (err) {
        setAutoSaveStatus(null);
        setFeedback({ type: 'error', text: err.message });
      } finally {
        if (!isAuto) setSaving(false);
      }
    },
    [edition, isVotingOpen, user]
  );

  useEffect(() => {
    if (!autoSaveEnabled || !user || !isVotingOpen || !isDirty || loading) return;
    const timer = setTimeout(() => {
      saveVotesToServer({ isAuto: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [autoSaveEnabled, user, isVotingOpen, isDirty, loading, currentSnapshot, saveVotesToServer]);

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tga_autosave', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const selectWillWin = useCallback(
    (categoryId, nomineeId) => {
      setVotesMap((prev) => {
        const next = {
          ...prev,
          [categoryId]: {
            will_win_nominee_id: nomineeId,
            want_win_nominee_id: prev[categoryId]?.want_win_nominee_id ?? null,
          },
        };
        persistDraft(edition?.year, next, sideBetVotesRef.current);
        return next;
      });
      setAutoSaveStatus(null);
    },
    [edition?.year, persistDraft]
  );

  const selectWantWin = useCallback(
    (categoryId, nomineeId) => {
      setVotesMap((prev) => {
        const next = {
          ...prev,
          [categoryId]: {
            will_win_nominee_id: prev[categoryId]?.will_win_nominee_id ?? null,
            want_win_nominee_id: nomineeId,
          },
        };
        persistDraft(edition?.year, next, sideBetVotesRef.current);
        return next;
      });
      setAutoSaveStatus(null);
    },
    [edition?.year, persistDraft]
  );

  const selectBoth = useCallback(
    (categoryId, nomineeId) => {
      setVotesMap((prev) => {
        const next = {
          ...prev,
          [categoryId]: {
            will_win_nominee_id: nomineeId,
            want_win_nominee_id: nomineeId,
          },
        };
        persistDraft(edition?.year, next, sideBetVotesRef.current);
        return next;
      });
      setAutoSaveStatus(null);
    },
    [edition?.year, persistDraft]
  );

  const selectSideBet = useCallback(
    (sideBetId, option) => {
      setSideBetVotesMap((prev) => {
        const next = { ...prev };
        if (!option) delete next[sideBetId];
        else next[sideBetId] = option;
        persistDraft(edition?.year, votesMapRef.current, next);
        return next;
      });
      setAutoSaveStatus(null);
    },
    [edition?.year, persistDraft]
  );

  const chaosFill = useCallback(() => {
    if (!isVotingOpen) return;
    const pendingCats = categories.filter((c) => {
      if (c.nominees.length === 0) return false;
      const v = votesMapRef.current[c.id];
      return !v || v.will_win_nominee_id == null || v.want_win_nominee_id == null;
    });
    if (pendingCats.length === 0) {
      setFeedback({ type: 'info', text: 'Todas as categorias já estão preenchidas!' });
      return;
    }
    if (
      !window.confirm(
        `Modo Caos: preencher aleatoriamente ${pendingCats.length} categoria(s) pendente(s)? (Suas escolhas já feitas serão mantidas.)`
      )
    ) {
      return;
    }

    setVotesMap((prev) => {
      const next = { ...prev };
      for (const cat of pendingCats) {
        const cur = next[cat.id] || {};
        const pickRandom = () =>
          cat.nominees[Math.floor(Math.random() * cat.nominees.length)].id;
        next[cat.id] = {
          will_win_nominee_id: cur.will_win_nominee_id ?? pickRandom(),
          want_win_nominee_id: cur.want_win_nominee_id ?? pickRandom(),
        };
      }
      persistDraft(edition?.year, next, sideBetVotesRef.current);
      return next;
    });
    setFeedback({
      type: 'info',
      text: `🎲 Modo Caos preencheu ${pendingCats.length} categorias pendentes!`,
    });
  }, [isVotingOpen, categories, edition?.year, persistDraft]);

  const counts = useMemo(() => {
    let complete = 0;
    let partial = 0;
    let empty = 0;
    for (const c of categories) {
      const v = votesMap[c.id];
      const hasWill = v?.will_win_nominee_id != null;
      const hasWant = v?.want_win_nominee_id != null;
      if (hasWill && hasWant) complete += 1;
      else if (hasWill || hasWant) partial += 1;
      else empty += 1;
    }
    const total = categories.length;
    return {
      total,
      complete,
      partial,
      empty,
      pending: partial + empty,
      anyFilled: complete + partial,
      progressPct: total > 0 ? Math.round((complete / total) * 100) : 0,
    };
  }, [categories, votesMap]);

  return {
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
    isAfterEnd,
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
  };
}
