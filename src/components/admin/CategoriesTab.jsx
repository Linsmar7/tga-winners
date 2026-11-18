import React, { useState } from 'react';
import { Copy, FileJson, Plus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import SearchInput from '../ui/SearchInput';
import CategoryAdminCard from './CategoryAdminCard';

export default function CategoriesTab({
  currentEdition,
  editions,
  categories,
  selectedEditionId,
  onReload,
  onOpenImportModal,
  onSwitchToEditions,
  notify,
}) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryWeight, setNewCategoryWeight] = useState(5);
  const [expandedCatId, setExpandedCatId] = useState(null);
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState(null);

  if (!currentEdition) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
        <p className="text-sm text-zinc-400">Crie uma edição primeiro na aba Edições.</p>
        <button
          type="button"
          onClick={onSwitchToEditions}
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950"
        >
          Criar Edição
        </button>
      </div>
    );
  }

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!selectedEditionId || !newCategoryName.trim()) return;
    try {
      const res = await apiFetch(`/api/admin/editions/${selectedEditionId}/categories`, {
        method: 'POST',
        body: { name: newCategoryName.trim(), points_weight: Number(newCategoryWeight) || 5 },
      });
      setNewCategoryName('');
      setNewCategoryWeight(5);
      setExpandedCatId(res.category.id);
      await onReload(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveCategory = async (catPayload) => {
    try {
      await apiFetch(`/api/admin/categories/${catPayload.id}`, {
        method: 'PUT',
        body: {
          name: catPayload.name,
          points_weight: Number(catPayload.points_weight) || 5,
        },
      });
      await onReload(selectedEditionId);
      notify('Categoria atualizada!');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const reorderCategories = async (newOrderedList) => {
    try {
      await apiFetch(`/api/admin/editions/${selectedEditionId}/categories/reorder`, {
        method: 'PUT',
        body: { orderedIds: newOrderedList.map((c) => c.id) },
      });
      await onReload(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleMoveCategory = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    await reorderCategories(reordered);
  };

  const handleDropCategory = async (targetCatId) => {
    if (!draggedId || draggedId === targetCatId) {
      setDraggedId(null);
      return;
    }
    const fromIdx = categories.findIndex((c) => c.id === draggedId);
    const toIdx = categories.findIndex((c) => c.id === targetCatId);
    setDraggedId(null);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await reorderCategories(reordered);
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Excluir categoria e seus indicados?')) return;
    try {
      await apiFetch(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      await onReload(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleImportPreviousCategories = async () => {
    try {
      const res = await apiFetch(`/api/admin/editions/${selectedEditionId}/import-categories`, {
        method: 'POST',
        body: {},
      });
      await onReload(selectedEditionId);
      notify(`${res.imported_count} categorias importadas!`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteNominee = async (nomineeId) => {
    try {
      await apiFetch(`/api/admin/nominees/${nomineeId}`, { method: 'DELETE' });
      await onReload(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const q = search.trim().toLowerCase();
  const filteredCategories = categories.filter((cat) => {
    if (!q) return true;
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.nominees.some((n) => n.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <form onSubmit={handleAddCategory} className="flex flex-1 flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nova categoria (ex: Game of the Year)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
          />
          <input
            type="number"
            min={1}
            max={100}
            title="Peso em pontos (Vai Ganhar)"
            value={newCategoryWeight}
            onChange={(e) => setNewCategoryWeight(e.target.value)}
            className="w-20 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-center text-xs font-semibold text-amber-300 outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </button>
        </form>

        {editions.length > 1 && (
          <button
            type="button"
            onClick={handleImportPreviousCategories}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Importar anterior</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenImportModal}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <FileJson className="h-3.5 w-3.5" />
          <span>Importar JSON</span>
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar categoria ou indicado..."
          />
          <span className="text-[11px] text-zinc-500">
            Arraste pelo ícone ⋮⋮ ou use as setas para reordenar
          </span>
        </div>
      )}

      {filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
          {categories.length === 0
            ? 'Nenhuma categoria nesta edição. Adicione acima ou importe do ano anterior.'
            : 'Nenhuma categoria encontrada na busca.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((cat) => {
            const idx = categories.findIndex((c) => c.id === cat.id);
            const isExpanded = expandedCatId === cat.id;

            return (
              <CategoryAdminCard
                key={cat.id}
                category={cat}
                index={idx}
                totalCategories={categories.length}
                isExpanded={isExpanded}
                isDraggable={!q}
                isDragging={draggedId === cat.id}
                onToggleExpand={() => setExpandedCatId(isExpanded ? null : cat.id)}
                onDragStart={() => setDraggedId(cat.id)}
                onDragOver={(e) => {
                  if (!q) e.preventDefault();
                }}
                onDrop={() => handleDropCategory(cat.id)}
                onMoveCategory={handleMoveCategory}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
                onDeleteNominee={handleDeleteNominee}
                onReload={() => onReload(selectedEditionId)}
                notify={notify}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
