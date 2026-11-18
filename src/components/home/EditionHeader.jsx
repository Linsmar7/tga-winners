import React from 'react';
import {
  Check,
  Copy,
  Dices,
  Heart,
  Image as ImageIcon,
  Shuffle,
  Trophy,
  Users,
} from 'lucide-react';
import CountdownBadge from '../CountdownBadge';

export default function EditionHeader({
  edition,
  summary,
  counts,
  sideBetsCount,
  filledSideBetsCount,
  isVotingOpen,
  copiedText,
  onCopyPicks,
  onOpenShareCard,
  onChaosFill,
  sectionTab,
  onChangeSectionTab,
}) {
  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex flex-wrap items-center gap-1.5">
          {counts.anyFilled > 0 && (
            <>
              <button
                type="button"
                onClick={onCopyPicks}
                title="Copiar resumo para WhatsApp / Discord"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                {copiedText ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedText ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenShareCard}
                title="Gerar imagem PNG dos seus palpites"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
                <span>Card PNG</span>
              </button>
            </>
          )}

          {isVotingOpen && counts.pending > 0 && (
            <button
              type="button"
              onClick={onChaosFill}
              title="Preencher aleatoriamente as categorias pendentes"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Modo Caos</span>
            </button>
          )}
        </div>
      </div>

      {sideBetsCount > 0 && (
        <div className="mt-4 flex items-center gap-1.5 border-t border-zinc-800/80 pt-3.5">
          <button
            type="button"
            onClick={() => onChangeSectionTab('categories')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              sectionTab === 'categories'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-zinc-100'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>
              Categorias ({counts.complete}/{counts.total})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSectionTab('side_bets')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              sectionTab === 'side_bets'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-zinc-100'
            }`}
          >
            <Dices className="h-3.5 w-3.5" />
            <span>
              Bingo / Extras ({filledSideBetsCount}/{sideBetsCount})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
