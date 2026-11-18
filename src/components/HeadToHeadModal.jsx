import React, { useEffect, useState } from 'react';
import { Award, Heart, Loader2, Swords, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Modal from './ui/Modal';

export default function HeadToHeadModal({
  open,
  onClose,
  year,
  voters = [],
  initialVoterA,
  initialVoterB,
}) {
  const [voterAId, setVoterAId] = useState(initialVoterA || '');
  const [voterBId, setVoterBId] = useState(initialVoterB || '');
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (initialVoterA) setVoterAId(initialVoterA);
    else if (voters[0]) setVoterAId(voters[0].voter_id);

    if (initialVoterB) setVoterBId(initialVoterB);
    else if (voters[1]) setVoterBId(voters[1].voter_id);
  }, [open, initialVoterA, initialVoterB, voters]);

  useEffect(() => {
    if (!open || !year || !voterAId || !voterBId) return;
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch(`/api/editions/${year}/compare?a=${voterAId}&b=${voterBId}`)
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
  }, [open, year, voterAId, voterBId]);

  const visibleCategories = (data?.categories || []).filter((c) =>
    onlyDivergent ? c.is_divergent : true
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Swords}
      title="Comparador Head-to-Head"
      subtitle="Compare palpites lado a lado"
      maxWidth="max-w-3xl"
      bodyClassName="p-0"
    >
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-5 py-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-11 sm:items-center">
          <select
            value={voterAId}
            onChange={(e) => setVoterAId(Number(e.target.value))}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none focus:border-amber-500 sm:col-span-5"
          >
            {voters.map((v) => (
              <option key={v.voter_id} value={v.voter_id}>
                #{v.position} {v.nickname} ({v.total_points} pts)
              </option>
            ))}
          </select>

          <div className="text-center text-xs font-black text-amber-400 sm:col-span-1">VS</div>

          <select
            value={voterBId}
            onChange={(e) => setVoterBId(Number(e.target.value))}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none focus:border-amber-500 sm:col-span-5"
          >
            {voters.map((v) => (
              <option key={v.voter_id} value={v.voter_id}>
                #{v.position} {v.nickname} ({v.total_points} pts)
              </option>
            ))}
          </select>
        </div>

        {data && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
              <span className="rounded-full bg-amber-500/15 px-3 py-1 font-semibold text-amber-300">
                Concordância Vai Ganhar: <strong>{data.summary.agreement_will_pct}%</strong> (
                {data.summary.same_will_count}/{data.summary.shared_will_count})
              </span>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
                Placar: <strong className="text-amber-400">{data.voter_a.total_points}</strong> ×{' '}
                <strong className="text-amber-400">{data.voter_b.total_points}</strong>
              </span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-300">
              <input
                type="checkbox"
                checked={onlyDivergent}
                onChange={(e) => setOnlyDivergent(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-500"
              />
              <span>Só divergências</span>
            </label>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : !data ? null : visibleCategories.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-xs text-zinc-400">
            {onlyDivergent
              ? 'Vocês concordaram em todas as categorias! 👯'
              : 'Nenhuma categoria para comparar.'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCategories.map((cat) => (
              <div
                key={cat.category_id}
                className={`rounded-xl border p-3.5 ${
                  cat.is_divergent
                    ? 'border-amber-500/30 bg-zinc-900/80'
                    : 'border-zinc-800 bg-zinc-900/40'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-300">
                    {cat.category_name}
                  </span>
                  {cat.winner && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                      <Award className="h-3.5 w-3.5" />
                      {cat.winner.name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { label: data.voter_a.nickname, side: cat.a },
                    { label: data.voter_b.nickname, side: cat.b },
                  ].map((col, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-xs"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-semibold text-zinc-200">{col.label}</span>
                        {cat.winner && (
                          <span
                            className={`font-bold ${
                              col.side.points > 0 ? 'text-amber-400' : 'text-zinc-500'
                            }`}
                          >
                            +{col.side.points} pts
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          col.side.will_win_correct === true
                            ? 'text-emerald-300'
                            : col.side.will_win_correct === false
                              ? 'text-zinc-500'
                              : 'text-zinc-300'
                        }`}
                      >
                        <Trophy className="h-3 w-3 shrink-0 text-amber-400" />
                        <span className="truncate">{col.side.will_win?.name || '—'}</span>
                      </div>
                      <div
                        className={`mt-1 flex items-center gap-1.5 ${
                          col.side.upset_bonus ? 'text-amber-300' : 'text-zinc-400'
                        }`}
                      >
                        <Heart className="h-3 w-3 shrink-0 text-rose-400" />
                        <span className="truncate">{col.side.want_win?.name || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
