import React, { useState } from 'react';
import { Award, Check } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import SearchInput from '../ui/SearchInput';

export default function WinnersTab({
  currentEdition,
  categories,
  selectedEditionId,
  onReload,
  notify,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'decided'

  if (!currentEdition) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        Nenhuma edição selecionada.
      </div>
    );
  }

  const decidedCount = categories.filter((c) => c.nominees.some((n) => n.is_winner)).length;

  const handleToggleFinished = async () => {
    try {
      await apiFetch(`/api/admin/editions/${currentEdition.id}`, {
        method: 'PUT',
        body: { is_finished: !currentEdition.is_finished },
      });
      await onReload(currentEdition.id);
      notify(
        !currentEdition.is_finished ? 'Edição marcada como finalizada!' : 'Edição reaberta.'
      );
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSetWinner = async (categoryId, nomineeId) => {
    try {
      await apiFetch(`/api/admin/categories/${categoryId}/winner`, {
        method: 'PUT',
        body: { nominee_id: nomineeId },
      });
      await onReload(selectedEditionId);
      notify(nomineeId ? 'Vencedor oficial marcado (enviado ao vivo)!' : 'Vencedor removido.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const q = search.trim().toLowerCase();
  const visibleCategories = categories.filter((cat) => {
    const hasWinner = cat.nominees.some((n) => n.is_winner);
    if (statusFilter === 'pending' && hasWinner) return false;
    if (statusFilter === 'decided' && !hasWinner) return false;
    if (q) {
      const matchCat = cat.name.toLowerCase().includes(q);
      const matchNom = cat.nominees.some((n) => n.name.toLowerCase().includes(q));
      if (!matchCat && !matchNom) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-100">
            Apuração TGA {currentEdition.year} (Ao Vivo via SSE)
          </h2>
          <p className="text-xs text-zinc-400">
            {decidedCount}/{categories.length} categorias com vencedor definido
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleFinished}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
            currentEdition.is_finished
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-500/50'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          <span>
            {currentEdition.is_finished ? 'Edição Finalizada' : 'Marcar como Finalizada'}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar categoria ou jogo anunciado ao vivo..."
          className="min-w-[220px]"
        />

        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {[
            { id: 'all', label: `Todas (${categories.length})` },
            { id: 'pending', label: `Faltam (${categories.length - decidedCount})` },
            { id: 'decided', label: `Apuradas (${decidedCount})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                statusFilter === opt.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {visibleCategories.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">
          Nenhuma categoria corresponde ao filtro.
        </div>
      ) : (
        visibleCategories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">{cat.name}</h3>
              <span className="text-[11px] text-zinc-500">+{cat.points_weight || 5} pts</span>
            </div>
            {cat.nominees.length === 0 ? (
              <p className="text-xs text-zinc-500">Sem indicados cadastrados.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {cat.nominees.map((nom) => (
                  <button
                    key={nom.id}
                    type="button"
                    onClick={() => handleSetWinner(cat.id, nom.is_winner ? null : nom.id)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
                      nom.is_winner
                        ? 'border-amber-500 bg-amber-500 font-bold text-zinc-950'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                    }`}
                  >
                    <span className="truncate">{nom.name}</span>
                    {nom.is_winner && <Award className="h-4 w-4 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
