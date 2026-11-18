import React, { memo } from 'react';
import { Trophy, Heart, Award, ExternalLink, CopyCheck } from 'lucide-react';
import NomineeImage from './NomineeImage';

function CategoryCard({
  category,
  vote,
  disabled,
  onSelectWillWin,
  onSelectWantWin,
  onSelectBoth,
}) {
  const winner = category.nominees.find((n) => n.is_winner) || null;
  const willWinId = vote?.will_win_nominee_id ?? null;
  const wantWinId = vote?.want_win_nominee_id ?? null;
  const weight = Number(category.points_weight) || 5;

  let categoryPoints = 0;
  if (winner) {
    if (willWinId === winner.id) categoryPoints += weight;
    if (wantWinId === winner.id && wantWinId !== willWinId) categoryPoints += 1;
  }

  const isComplete = willWinId !== null && wantWinId !== null;
  const isPartial = (willWinId !== null || wantWinId !== null) && !isComplete;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-400">
            {category.display_order || '•'}
          </span>
          <h2 className="truncate text-sm font-semibold text-zinc-100 sm:text-base">
            {category.name}
          </h2>
          {weight !== 5 && (
            <span
              title={`Esta categoria vale ${weight} pontos em Vai Ganhar`}
              className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30"
            >
              +{weight} pts
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!disabled && willWinId !== null && wantWinId !== willWinId && (
            <button
              type="button"
              onClick={() => onSelectWantWin(category.id, willWinId)}
              title="Copiar escolha de Vai Ganhar para Quero que Ganhe"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 transition hover:border-rose-500/40 hover:text-rose-300"
            >
              <CopyCheck className="h-3 w-3" />
              <span className="hidden xs:inline sm:inline">Igual ao Vai Ganhar</span>
            </button>
          )}

          {winner && (willWinId || wantWinId) ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                categoryPoints > 0
                  ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              +{categoryPoints} pts
            </span>
          ) : isComplete ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              Completa
            </span>
          ) : isPartial ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20">
              Parcial
            </span>
          ) : null}
        </div>
      </div>

      {category.nominees.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-500">
          Nenhum indicado cadastrado nesta categoria ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 sm:p-4">
          {category.nominees.map((nominee) => {
            const isWillSelected = willWinId === nominee.id;
            const isWantSelected = wantWinId === nominee.id;
            const isWinner = nominee.is_winner;

            return (
              <div
                key={nominee.id}
                onDoubleClick={() => {
                  if (!disabled && onSelectBoth) {
                    onSelectBoth(category.id, nominee.id);
                  }
                }}
                title={
                  !disabled ? 'Dica: clique duas vezes para marcar Vai Ganhar + Quero' : undefined
                }
                className={`flex flex-col justify-between gap-3 rounded-xl border p-3 transition ${
                  isWinner
                    ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20'
                    : isWillSelected || isWantSelected
                      ? 'border-zinc-700 bg-zinc-950/70'
                      : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <NomineeImage src={nominee.image_url} alt={nominee.name} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="text-sm font-semibold leading-snug text-zinc-100">
                        {nominee.name}
                      </h3>
                      <div className="flex shrink-0 items-center gap-1">
                        {nominee.external_url && (
                          <a
                            href={nominee.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Abrir página / trailer do indicado"
                            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-amber-400"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {isWinner && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">
                            <Award className="h-3 w-3" />
                            Vencedor
                          </span>
                        )}
                      </div>
                    </div>
                    {nominee.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                        {nominee.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectWillWin(category.id, isWillSelected ? null : nominee.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                      isWillSelected
                        ? 'border-amber-500 bg-amber-500 text-zinc-950 shadow-sm'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300'
                    } ${disabled ? 'cursor-not-allowed opacity-75' : 'active:scale-[0.98]'}`}
                  >
                    <Trophy className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Vai Ganhar</span>
                  </button>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectWantWin(category.id, isWantSelected ? null : nominee.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                      isWantSelected
                        ? 'border-rose-500 bg-rose-500 text-white shadow-sm'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-rose-500/40 hover:text-rose-300'
                    } ${disabled ? 'cursor-not-allowed opacity-75' : 'active:scale-[0.98]'}`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 shrink-0 ${isWantSelected ? 'fill-current' : ''}`}
                    />
                    <span className="truncate">Quero</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(CategoryCard);
