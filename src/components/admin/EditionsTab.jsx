import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Download, Database } from 'lucide-react';
import { apiFetch } from '../../lib/api';

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function defaultEditionDates(year) {
  return {
    voting_start: `${year}-11-18T14:00`,
    voting_end: `${year}-12-10T21:00`,
    event_date: `${year}-12-10T21:30`,
  };
}

export default function EditionsTab({
  editions,
  selectedEditionId,
  onSelectEdition,
  onReload,
  onSwitchToCategories,
  notify,
}) {
  const currentYear = new Date().getFullYear();
  const [newEdition, setNewEdition] = useState({
    year: currentYear,
    ...defaultEditionDates(currentYear),
    import_previous: true,
  });
  const [editingEdition, setEditingEdition] = useState(null);

  const handleCreateEdition = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/editions', {
        method: 'POST',
        body: {
          year: Number(newEdition.year),
          voting_start: new Date(newEdition.voting_start).toISOString(),
          voting_end: new Date(newEdition.voting_end).toISOString(),
          event_date: new Date(newEdition.event_date).toISOString(),
          import_previous: Boolean(newEdition.import_previous),
        },
      });
      await onReload();
      onSelectEdition(res.edition.id);
      onSwitchToCategories();
      notify(
        res.imported_categories_count > 0
          ? `Edição ${res.edition.year} criada com ${res.imported_categories_count} categorias importadas!`
          : `Edição ${res.edition.year} criada!`
      );
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleUpdateEdition = async (e) => {
    e.preventDefault();
    if (!editingEdition) return;
    try {
      await apiFetch(`/api/admin/editions/${editingEdition.id}`, {
        method: 'PUT',
        body: {
          year: Number(editingEdition.year),
          voting_start: new Date(editingEdition.voting_start).toISOString(),
          voting_end: new Date(editingEdition.voting_end).toISOString(),
          event_date: new Date(editingEdition.event_date).toISOString(),
          is_finished: editingEdition.is_finished,
        },
      });
      setEditingEdition(null);
      await onReload(selectedEditionId);
      notify('Edição atualizada!');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteEdition = async (id, year) => {
    if (!window.confirm(`Excluir toda a edição ${year} e seus votos?`)) return;
    try {
      await apiFetch(`/api/admin/editions/${id}`, { method: 'DELETE' });
      await onReload();
      notify(`Edição ${year} removida.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreateEdition}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:col-span-5"
        >
          <h2 className="text-sm font-bold text-zinc-100">Nova Edição</h2>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Ano</label>
            <input
              type="number"
              required
              min={2014}
              max={2100}
              value={newEdition.year}
              onChange={(e) => {
                const y = e.target.value;
                setNewEdition((prev) => ({
                  ...prev,
                  year: y,
                  ...(String(y).length === 4 ? defaultEditionDates(y) : {}),
                }));
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Início da Votação</label>
            <input
              type="datetime-local"
              required
              value={newEdition.voting_start}
              onChange={(e) =>
                setNewEdition((prev) => ({ ...prev, voting_start: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Fim da Votação</label>
            <input
              type="datetime-local"
              required
              value={newEdition.voting_end}
              onChange={(e) =>
                setNewEdition((prev) => ({ ...prev, voting_end: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Data do Evento TGA</label>
            <input
              type="datetime-local"
              required
              value={newEdition.event_date}
              onChange={(e) =>
                setNewEdition((prev) => ({ ...prev, event_date: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>

          {editions.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={newEdition.import_previous}
                onChange={(e) =>
                  setNewEdition((prev) => ({ ...prev, import_previous: e.target.checked }))
                }
                className="h-4 w-4 accent-amber-500"
              />
              <span>Importar categorias do ano anterior</span>
            </label>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            <span>Criar Edição</span>
          </button>
        </form>

        <div className="space-y-3 lg:col-span-7">
          {editions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
              Nenhuma edição criada ainda.
            </div>
          ) : (
            editions.map((ed) => {
              const isEditing = editingEdition?.id === ed.id;
              return (
                <div
                  key={ed.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
                >
                  {isEditing ? (
                    <form onSubmit={handleUpdateEdition} className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Ano</label>
                          <input
                            type="number"
                            value={editingEdition.year}
                            onChange={(e) =>
                              setEditingEdition((p) => ({ ...p, year: e.target.value }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Início</label>
                          <input
                            type="datetime-local"
                            value={editingEdition.voting_start}
                            onChange={(e) =>
                              setEditingEdition((p) => ({ ...p, voting_start: e.target.value }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Fim</label>
                          <input
                            type="datetime-local"
                            value={editingEdition.voting_end}
                            onChange={(e) =>
                              setEditingEdition((p) => ({ ...p, voting_end: e.target.value }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">Evento</label>
                          <input
                            type="datetime-local"
                            value={editingEdition.event_date}
                            onChange={(e) =>
                              setEditingEdition((p) => ({ ...p, event_date: e.target.value }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEdition(null)}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950"
                        >
                          Salvar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-zinc-100">TGA {ed.year}</span>
                          {ed.is_finished && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              Finalizado
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {ed.categories_count} categorias · {ed.nominees_count} indicados ·{' '}
                          {ed.voters_count} participantes
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          Encerra: {new Date(ed.voting_end).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/admin/editions/${ed.id}/export`}
                          download
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:border-amber-500/40 hover:text-amber-300"
                          title="Exportar JSON completo da edição"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEdition({
                              id: ed.id,
                              year: ed.year,
                              voting_start: toLocalDatetimeInput(ed.voting_start),
                              voting_end: toLocalDatetimeInput(ed.voting_end),
                              event_date: toLocalDatetimeInput(ed.event_date),
                              is_finished: ed.is_finished,
                            })
                          }
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEdition(ed.id, ed.year)}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Backup Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-2.5">
          <Database className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Backup Completo do Banco SQLite</h3>
            <p className="text-xs text-zinc-400">
              Gera um snapshot consistente do database.sqlite (seguro mesmo com WAL ativo)
            </p>
          </div>
        </div>
        <a
          href="/api/admin/backup/db"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Baixar database.sqlite</span>
        </a>
      </div>
    </div>
  );
}
