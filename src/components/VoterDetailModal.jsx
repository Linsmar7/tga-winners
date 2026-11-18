import React, { useEffect, useState } from 'react';
import { Award, Check, Copy, Dices, Heart, Loader2, Swords, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatVoterDetailsForClipboard } from '../lib/formatters';
import Modal from './ui/Modal';
import NomineeImage from './NomineeImage';

export default function VoterDetailModal({
  year,
  voterId,
  onClose,
  onCompareWith,
  canCompare = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!voterId || !year) return;
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch(`/api/editions/${year}/voters/${voterId}`)
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
  }, [year, voterId]);

  const handleCopyText = async () => {
    if (!data) return;
    const text = formatVoterDetailsForClipboard({
      year,
      voter: data.voter,
      categories: data.categories,
      sideBets: data.side_bets,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const subtitle = data?.voter ? (
    <span>
      <span className="font-semibold text-amber-400">{data.voter.total_points} pts</span>
      {' · '}
      {data.voter.will_win_hits} acertos em Vai Ganhar
      {data.voter.want_win_bonus_hits > 0 && ` · ${data.voter.want_win_bonus_hits} bônus zebra`}
      {data.voter.side_bet_hits > 0 && ` · ${data.voter.side_bet_hits} extras`}
    </span>
  ) : null;

  const headerActions = data ? (
    <>
      <button
        type="button"
        onClick={handleCopyText}
        title="Copiar resumo para WhatsApp/Discord"
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
      </button>

      {canCompare && onCompareWith && (
        <button
          type="button"
          onClick={() => onCompareWith(data.voter.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <Swords className="h-3.5 w-3.5" />
          <span>Comparar</span>
        </button>
      )}
    </>
  ) : null;

  return (
    <Modal
      open={Boolean(voterId)}
      onClose={onClose}
      title={data?.voter?.nickname || 'Palpites do Participante'}
      subtitle={subtitle}
      headerActions={headerActions}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-rose-400">{error}</p>
      ) : !data ? null : (
        <div className="space-y-3">
          {data.categories.map((item) => (
            <div
              key={item.category_id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {item.category_name}
                  {item.points_weight !== 5 && (
                    <span className="ml-1.5 text-amber-400">(+{item.points_weight} pts)</span>
                  )}
                </span>
                {item.winner ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      item.points > 0
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    +{item.points} pts
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-600">Aguardando</span>
                )}
              </div>

              {item.winner && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
                  <Award className="h-3.5 w-3.5 shrink-0" />
                  <span>Vencedor: {item.winner.name}</span>
                </div>
              )}

              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                    item.will_win_correct === true
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : item.will_win_correct === false
                        ? 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                  }`}
                >
                  {item.will_win?.image_url ? (
                    <NomineeImage
                      src={item.will_win.image_url}
                      alt={item.will_win.name}
                      className="h-6 w-6 rounded"
                      iconClassName="h-3.5 w-3.5"
                    />
                  ) : (
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <span className="truncate">{item.will_win ? item.will_win.name : '—'}</span>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                    item.upset_bonus
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : item.want_win_correct === false
                        ? 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                  }`}
                >
                  {item.want_win?.image_url ? (
                    <NomineeImage
                      src={item.want_win.image_url}
                      alt={item.want_win.name}
                      className="h-6 w-6 rounded"
                      iconClassName="h-3.5 w-3.5"
                    />
                  ) : (
                    <Heart className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  )}
                  <span className="truncate">{item.want_win ? item.want_win.name : '—'}</span>
                </div>
              </div>
            </div>
          ))}

          {data.side_bets && data.side_bets.length > 0 && (
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Dices className="h-3.5 w-3.5" />
                <span>Palpites Extras (Bingo)</span>
              </div>
              <div className="space-y-2">
                {data.side_bets.map((sb) => (
                  <div
                    key={sb.side_bet_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200">{sb.question}</p>
                      <p className="mt-0.5 text-zinc-400">
                        Palpite: <strong className="text-zinc-100">{sb.selected_option || '—'}</strong>
                        {sb.correct_option && (
                          <>
                            {' · '}Oficial:{' '}
                            <strong className="text-emerald-400">{sb.correct_option}</strong>
                          </>
                        )}
                      </p>
                    </div>
                    {sb.correct_option && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          sb.points > 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        +{sb.points} pts
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
