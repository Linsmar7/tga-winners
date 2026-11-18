import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';

const LINE_COLORS = [
  '#fbbf24', // amber
  '#34d399', // emerald
  '#60a5fa', // blue
  '#f43f5e', // rose
  '#c084fc', // purple
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f472b6', // pink
  '#a3e635', // lime
  '#38bdf8', // sky
];

export default function RankingEvolutionChart({ evolution, highlightVoterId = null }) {
  const [chartMode, setChartMode] = useState('points'); // 'points' | 'position'
  const [hoveredStepIdx, setHoveredStepIdx] = useState(null);
  const [hiddenVoters, setHiddenVoters] = useState(() => new Set());

  const voters = evolution?.voters || [];
  const steps = evolution?.steps || [];

  const visibleVoters = useMemo(
    () => voters.filter((v) => !hiddenVoters.has(v.voter_id)),
    [voters, hiddenVoters]
  );

  if (voters.length === 0 || steps.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        Nenhum participante registrado ainda para exibir a evolução do ranking.
      </div>
    );
  }

  const toggleVoter = (voterId) => {
    setHiddenVoters((prev) => {
      const next = new Set(prev);
      if (next.has(voterId)) next.delete(voterId);
      else next.add(voterId);
      return next;
    });
  };

  // SVG dimensions
  const width = 760;
  const height = 340;
  const pad = { top: 24, right: 28, bottom: 44, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxPoints = Math.max(
    5,
    ...steps.flatMap((s) => Object.values(s.standings || {}).map((st) => st.points || 0))
  );
  const maxPos = Math.max(2, voters.length);

  const getX = (stepIndex) => {
    if (steps.length <= 1) return pad.left + plotW / 2;
    return pad.left + (stepIndex / (steps.length - 1)) * plotW;
  };

  const getY = (standing) => {
    if (chartMode === 'points') {
      const pts = standing?.points || 0;
      return pad.top + plotH - (pts / maxPoints) * plotH;
    }
    const pos = standing?.position || maxPos;
    return pad.top + ((pos - 1) / Math.max(1, maxPos - 1)) * plotH;
  };

  const yTicks =
    chartMode === 'points'
      ? [0, Math.round(maxPoints * 0.25), Math.round(maxPoints * 0.5), Math.round(maxPoints * 0.75), maxPoints]
      : Array.from({ length: Math.min(maxPos, 6) }, (_, idx) =>
          Math.round(1 + (idx / Math.max(1, Math.min(maxPos, 6) - 1)) * (maxPos - 1))
        );

  const activeStep = hoveredStepIdx !== null ? steps[hoveredStepIdx] : steps[steps.length - 1];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-100">
                Evolução ao Longo da Cerimônia
              </h3>
              <p className="text-[11px] text-zinc-400">
                {steps.length > 1
                  ? `${steps.length - 1} categorias/extras apurados desde 17/11/2026`
                  : 'Linha base inicial (17/11/2026) pronta — a curva evolui a cada vencedor anunciado!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setChartMode('points')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                chartMode === 'points'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Pontos
            </button>
            <button
              type="button"
              onClick={() => setChartMode('position')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                chartMode === 'position'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Posição (#)
            </button>
          </div>
        </div>

        {/* Interactive SVG Chart */}
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full min-w-[520px] select-none"
          >
            {/* Horizontal grid lines */}
            {yTicks.map((tick, idx) => {
              const y =
                chartMode === 'points'
                  ? pad.top + plotH - (tick / maxPoints) * plotH
                  : pad.top + ((tick - 1) / Math.max(1, maxPos - 1)) * plotH;
              return (
                <g key={`${tick}-${idx}`}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={width - pad.right}
                    y2={y}
                    stroke="#27272a"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={pad.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#71717a"
                    fontSize="11"
                  >
                    {chartMode === 'points' ? `${tick}` : `#${tick}`}
                  </text>
                </g>
              );
            })}

            {/* Vertical hover indicator */}
            {hoveredStepIdx !== null && (
              <line
                x1={getX(hoveredStepIdx)}
                y1={pad.top}
                x2={getX(hoveredStepIdx)}
                y2={pad.top + plotH}
                stroke="#f59e0b"
                strokeOpacity="0.4"
                strokeWidth="1.5"
              />
            )}

            {/* Player lines */}
            {visibleVoters.map((voter) => {
              const colorIdx = voters.findIndex((v) => v.voter_id === voter.voter_id);
              const color = LINE_COLORS[colorIdx % LINE_COLORS.length];
              const isMe = highlightVoterId && voter.voter_id === highlightVoterId;

              const pointsStr = steps
                .map((s, sIdx) => `${getX(sIdx)},${getY(s.standings[voter.voter_id])}`)
                .join(' ');

              return (
                <g key={voter.voter_id}>
                  {steps.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={color}
                      strokeWidth={isMe ? 3.5 : 2.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={isMe ? 1 : 0.85}
                      points={pointsStr}
                    />
                  )}
                  {steps.map((s, sIdx) => (
                    <circle
                      key={s.id}
                      cx={getX(sIdx)}
                      cy={getY(s.standings[voter.voter_id])}
                      r={hoveredStepIdx === sIdx ? 5.5 : isMe ? 4.5 : 3.5}
                      fill={color}
                      stroke="#09090b"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              );
            })}

            {/* X-axis labels & interactive columns */}
            {steps.map((s, sIdx) => {
              const x = getX(sIdx);
              const showLabel =
                steps.length <= 10 ||
                sIdx === 0 ||
                sIdx === steps.length - 1 ||
                sIdx % Math.ceil(steps.length / 8) === 0;
              const colW = steps.length > 1 ? plotW / (steps.length - 1) : plotW;

              return (
                <g key={s.id}>
                  {showLabel && (
                    <text
                      x={x}
                      y={height - 14}
                      textAnchor="middle"
                      fill={hoveredStepIdx === sIdx ? '#fbbf24' : '#71717a'}
                      fontSize="10"
                      fontWeight={hoveredStepIdx === sIdx ? '700' : '500'}
                    >
                      {s.short_label}
                    </text>
                  )}
                  <rect
                    x={Math.max(pad.left, x - colW / 2)}
                    y={pad.top}
                    width={colW}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredStepIdx(sIdx)}
                    onMouseLeave={() => setHoveredStepIdx(null)}
                    onClick={() => setHoveredStepIdx(sIdx)}
                    className="cursor-pointer"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Active Step Tooltip Card */}
        {activeStep && (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-300">{activeStep.label}</span>
              <span className="text-[11px] text-zinc-500">
                {activeStep.winner_name ? `Vencedor: ${activeStep.winner_name} · ` : ''}
                {new Date(activeStep.timestamp).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleVoters
                .slice()
                .sort(
                  (a, b) =>
                    (activeStep.standings[a.voter_id]?.position || 99) -
                    (activeStep.standings[b.voter_id]?.position || 99)
                )
                .map((v) => {
                  const st = activeStep.standings[v.voter_id] || { points: 0, position: 1 };
                  const colorIdx = voters.findIndex((item) => item.voter_id === v.voter_id);
                  const color = LINE_COLORS[colorIdx % LINE_COLORS.length];
                  return (
                    <span
                      key={v.voter_id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-zinc-200">{v.nickname}</span>
                      <span className="text-zinc-400">
                        #{st.position} ({st.points} pts)
                      </span>
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* Interactive Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-zinc-500">Participantes (clique para filtrar):</span>
          {voters.map((v, idx) => {
            const isHidden = hiddenVoters.has(v.voter_id);
            const color = LINE_COLORS[idx % LINE_COLORS.length];
            return (
              <button
                key={v.voter_id}
                type="button"
                onClick={() => toggleVoter(v.voter_id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  isHidden
                    ? 'border-zinc-800 bg-zinc-950 text-zinc-600 line-through'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-500/40'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isHidden ? '#3f3f46' : color }}
                />
                <span>{v.nickname}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
