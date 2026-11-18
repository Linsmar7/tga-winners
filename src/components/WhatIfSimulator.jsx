import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Minus, RotateCcw, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { computeSimulatedRanking } from '../lib/simulation';
import PositionBadge from './ui/PositionBadge';

export default function WhatIfSimulator({ year, currentRanking = [], currentUserId = null }) {
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hypWinners, setHypWinners] = useState({});
  const [hypSideBets, setHypSideBets] = useState({});

  useEffect(() => {
    if (!year) return;
    let active = true;
    setLoading(true);
    apiFetch(`/api/editions/${year}/simulation-data`)
      .then((res) => {
        if (active) setSimData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);

  const currentPosMap = useMemo(() => {
    const m = new Map();
    for (const r of currentRanking) {
      m.set(r.voter_id, { position: r.position, points: r.total_points });
    }
    return m;
  }, [currentRanking]);

  const pendingCategories = useMemo(() => {
    if (!simData) return [];
    const byCat = new Map();
    for (const n of simData.nominees) {
      if (!byCat.has(n.category_id)) byCat.set(n.category_id, []);
      byCat.get(n.category_id).push(n);
    }
    return simData.categories
      .map((c) => ({ ...c, nominees: byCat.get(c.id) || [] }))
      .filter((c) => c.nominees.length > 0 && !c.nominees.some((n) => n.is_winner));
  }, [simData]);

  const pendingSideBets = useMemo(
    () => (simData?.side_bets || []).filter((sb) => !sb.correct_option),
    [simData]
  );

  const simulatedRanking = useMemo(
    () => computeSimulatedRanking(simData, hypWinners, hypSideBets),
    [simData, hypWinners, hypSideBets]
  );

  const selectedCount =
    Object.values(hypWinners).filter(Boolean).length +
    Object.values(hypSideBets).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (pendingCategories.length === 0 && pendingSideBets.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        Todas as categorias desta edição já foram apuradas! Não há mais cenários pendentes para
        simular.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-amber-200">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Clique nos vencedores hipotéticos ({selectedCount} simulados) para ver quem leva o
              bolão!
            </span>
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setHypWinners({});
                setHypSideBets({});
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-zinc-100"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {pendingCategories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-200">{cat.name}</h4>
              <span className="text-[10px] text-zinc-500">+{cat.points_weight} pts</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.nominees.map((nom) => {
                const selected = hypWinners[cat.id] === nom.id;
                return (
                  <button
                    key={nom.id}
                    type="button"
                    onClick={() =>
                      setHypWinners((prev) => ({
                        ...prev,
                        [cat.id]: selected ? null : nom.id,
                      }))
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'border-amber-500 bg-amber-500 font-bold text-zinc-950'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                    }`}
                  >
                    {nom.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {pendingSideBets.map((sb) => (
          <div
            key={sb.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-200">🎲 {sb.question}</h4>
              <span className="text-[10px] text-zinc-500">+{sb.points} pts</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sb.options.map((opt) => {
                const selected = hypSideBets[sb.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      setHypSideBets((prev) => ({
                        ...prev,
                        [sb.id]: selected ? null : opt,
                      }))
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'border-amber-500 bg-amber-500 font-bold text-zinc-950'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-bold text-amber-400">Placar Simulado</h3>
            <p className="text-[11px] text-zinc-400">Comparado com a classificação atual</p>
          </div>
          <div className="divide-y divide-zinc-800/70">
            {simulatedRanking.map((entry) => {
              const prev = currentPosMap.get(entry.voter_id);
              const posDelta = prev ? prev.position - entry.position : 0;
              const ptsDelta = prev ? entry.total_points - prev.points : 0;
              const isMe = currentUserId && entry.user_id === currentUserId;

              return (
                <div
                  key={entry.voter_id}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 ${
                    isMe ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PositionBadge position={entry.position} size="sm" />
                    <span className="truncate text-xs font-semibold text-zinc-100">
                      {entry.nickname}
                    </span>
                    {posDelta > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-400">
                        <ArrowUp className="h-3 w-3" />
                        {posDelta}
                      </span>
                    ) : posDelta < 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-rose-400">
                        <ArrowDown className="h-3 w-3" />
                        {Math.abs(posDelta)}
                      </span>
                    ) : (
                      <Minus className="h-3 w-3 text-zinc-600" />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    {ptsDelta > 0 && (
                      <span className="font-semibold text-emerald-400">+{ptsDelta}</span>
                    )}
                    <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-bold text-amber-400">
                      {entry.total_points} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
