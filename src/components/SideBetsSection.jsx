import React from 'react';
import { Dices, CheckCircle2, Sparkles } from 'lucide-react';

export default function SideBetsSection({
  sideBets = [],
  votesMap = {},
  disabled = false,
  onSelectOption,
}) {
  if (sideBets.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
        Nenhum palpite extra (Bingo do TGA) cadastrado nesta edição ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
        <Dices className="h-4 w-4 shrink-0 text-amber-400" />
        <span>
          <strong>Bingo / Palpites Extras:</strong> acerte acontecimentos da cerimônia para somar
          pontos bônus no ranking!
        </span>
      </div>

      {sideBets.map((sb, idx) => {
        const chosen = votesMap[sb.id] || null;
        const isDecided = Boolean(sb.correct_option);
        const isCorrect = isDecided && chosen === sb.correct_option;

        return (
          <section
            key={sb.id}
            className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-xs font-bold text-amber-400">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
                    {sb.question}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Vale <strong className="text-amber-400">+{sb.points} pts</strong>
                    {isDecided && (
                      <>
                        {' · '}Resultado:{' '}
                        <strong className="text-emerald-400">{sb.correct_option}</strong>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {isDecided ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isCorrect
                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isCorrect ? `+${sb.points} pts` : '+0 pts'}
                </span>
              ) : chosen ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  Respondida
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {sb.options.map((opt) => {
                const isSelected = chosen === opt;
                const isOfficial = sb.correct_option === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectOption(sb.id, isSelected ? null : opt)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-zinc-950 shadow-sm'
                        : isOfficial
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300'
                    } ${disabled ? 'cursor-not-allowed opacity-80' : 'active:scale-[0.98]'}`}
                  >
                    {isOfficial && <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
