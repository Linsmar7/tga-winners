import React, { useState } from 'react';
import { Award, Heart, Trophy } from 'lucide-react';
import NomineeImage from './NomineeImage';
import SearchInput from './ui/SearchInput';

export default function ConsensusView({ consensus = [] }) {
  const [search, setSearch] = useState('');
  const [metric, setMetric] = useState('both'); // 'both' | 'will' | 'want'

  const query = search.trim().toLowerCase();
  const filtered = consensus.filter((cat) => {
    if (!query) return true;
    return (
      cat.category_name.toLowerCase().includes(query) ||
      cat.nominees.some((n) => n.name.toLowerCase().includes(query))
    );
  });

  if (consensus.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        Nenhuma categoria disponível para consenso.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filtrar categoria ou jogo..."
          className="min-w-[200px]"
        />

        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {[
            { id: 'both', label: 'Ambos' },
            { id: 'will', label: 'Vai Ganhar' },
            { id: 'want', label: 'Quero' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMetric(opt.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                metric === opt.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((cat) => {
          const sortedNominees = [...cat.nominees].sort(
            (a, b) =>
              (metric === 'want'
                ? b.want_win_count - a.want_win_count
                : b.will_win_count - a.will_win_count) || b.want_win_count - a.want_win_count
          );

          return (
            <section
              key={cat.category_id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-100">{cat.category_name}</h3>
                <span className="text-[11px] text-zinc-400">
                  {cat.total_will_votes} votos Vai Ganhar · {cat.total_want_votes} Quero
                </span>
              </div>

              <div className="space-y-3">
                {sortedNominees.map((nom) => (
                  <div
                    key={nom.id}
                    className={`rounded-xl border p-2.5 ${
                      nom.is_winner
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-zinc-800/80 bg-zinc-950/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <NomineeImage
                        src={nom.image_url}
                        alt={nom.name}
                        className="h-9 w-9 rounded-lg"
                        iconClassName="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-zinc-100">
                            {nom.name}
                          </span>
                          {nom.is_winner && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
                              <Award className="h-3 w-3" />
                              Vencedor
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 space-y-1">
                          {(metric === 'both' || metric === 'will') && (
                            <div className="flex items-center gap-2">
                              <Trophy className="h-3 w-3 shrink-0 text-amber-400" />
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                                  style={{ width: `${nom.will_win_pct}%` }}
                                />
                              </div>
                              <span className="w-16 text-right text-[11px] font-semibold text-amber-300">
                                {nom.will_win_pct}% ({nom.will_win_count})
                              </span>
                            </div>
                          )}

                          {(metric === 'both' || metric === 'want') && (
                            <div className="flex items-center gap-2">
                              <Heart className="h-3 w-3 shrink-0 text-rose-400" />
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-rose-500 transition-all duration-300"
                                  style={{ width: `${nom.want_win_pct}%` }}
                                />
                              </div>
                              <span className="w-16 text-right text-[11px] font-semibold text-rose-300">
                                {nom.want_win_pct}% ({nom.want_win_count})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
