import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import NomineeImage from '../NomineeImage';
import NomineeAdminForm from './NomineeAdminForm';

export default function CategoryAdminCard({
  category,
  index,
  totalCategories,
  isExpanded,
  isDraggable,
  isDragging,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveCategory,
  onSaveCategory,
  onDeleteCategory,
  onDeleteNominee,
  onReload,
  notify,
}) {
  const [editingCat, setEditingCat] = useState(null);
  const [editingNominee, setEditingNominee] = useState(null);

  const handleSubmitCategoryEdit = async (e) => {
    e.preventDefault();
    if (!editingCat) return;
    await onSaveCategory(editingCat);
    setEditingCat(null);
  };

  return (
    <div
      draggable={isDraggable && !editingCat}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`overflow-hidden rounded-2xl border bg-zinc-900/70 transition ${
        isDragging ? 'border-amber-500/60 opacity-60' : 'border-zinc-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        {editingCat ? (
          <form
            onSubmit={handleSubmitCategoryEdit}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={editingCat.name}
              onChange={(e) => setEditingCat((p) => ({ ...p, name: e.target.value }))}
              className="min-w-[160px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              <span>Peso:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={editingCat.points_weight}
                onChange={(e) => setEditingCat((p) => ({ ...p, points_weight: e.target.value }))}
                className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-xs text-amber-300"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-zinc-950"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setEditingCat(null)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            {isDraggable && (
              <span
                className="cursor-grab text-zinc-600 hover:text-zinc-400"
                title="Arrastar para reordenar"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingNominee(null);
                onToggleExpand();
              }}
              className="flex flex-1 flex-wrap items-center gap-2 text-left"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-400">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-zinc-100">{category.name}</span>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                {category.nominees.length} indicados
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                +{category.points_weight || 5} pts
              </span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveCategory(index, -1)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            title="Mover para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === totalCategories - 1}
            onClick={() => onMoveCategory(index, 1)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              setEditingCat({
                id: category.id,
                name: category.name,
                points_weight: category.points_weight || 5,
              })
            }
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Editar nome e peso"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteCategory(category.id)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-800 bg-zinc-950/60 p-4">
          {category.nominees.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {category.nominees.map((nom) => (
                <div
                  key={nom.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <NomineeImage
                      src={nom.image_url}
                      alt={nom.name}
                      className="h-10 w-10 rounded-lg"
                      iconClassName="h-4 w-4"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-zinc-100">{nom.name}</p>
                        {nom.external_url && (
                          <a
                            href={nom.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-amber-400"
                            title="Abrir link externo"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {nom.description && (
                        <p className="truncate text-[11px] text-zinc-400">{nom.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingNominee(nom)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNominee(nom.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <NomineeAdminForm
            categoryId={category.id}
            editingNominee={editingNominee}
            onClearEditing={() => setEditingNominee(null)}
            onSaved={onReload}
            notify={notify}
          />
        </div>
      )}
    </div>
  );
}
