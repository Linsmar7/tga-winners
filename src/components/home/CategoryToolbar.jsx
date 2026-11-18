import React from 'react';
import { Layers, List } from 'lucide-react';
import SearchInput from '../ui/SearchInput';

export default function CategoryToolbar({
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  viewMode,
  onViewModeChange,
  counts,
}) {
  const filters = [
    { id: 'all', label: `Todas (${counts.total})` },
    { id: 'pending', label: `Pendentes (${counts.pending})` },
    { id: 'complete', label: `Completas (${counts.complete})` },
    { id: 'partial', label: `Parciais (${counts.partial})` },
    { id: 'empty', label: `Vazias (${counts.empty})` },
  ];

  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Buscar categoria ou jogo..."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterModeChange(f.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                filterMode === f.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            title="Modo Lista"
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              viewMode === 'list'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lista</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('focus')}
            title="Modo Foco (1 categoria por vez)"
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              viewMode === 'focus'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Foco</span>
          </button>
        </div>
      </div>
    </div>
  );
}
