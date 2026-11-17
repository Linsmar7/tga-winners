import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Award,
  Upload,
  LogOut,
  Loader2,
  Copy,
  Check,
  Pencil,
  Calendar,
  ListChecks,
  Users,
  X,
  Gamepad2,
  FileJson,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { apiFetch } from '../lib/api';

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

export default function AdminPanel() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [editions, setEditions] = useState([]);
  const [selectedEditionId, setSelectedEditionId] = useState(null);
  const [editionDetail, setEditionDetail] = useState(null); // { edition, categories, voters }
  const [activeTab, setActiveTab] = useState('categories'); // 'editions' | 'categories' | 'winners' | 'voters'
  const [toast, setToast] = useState(null);

  // New Edition form
  const currentYear = new Date().getFullYear();
  const [newEdition, setNewEdition] = useState({
    year: currentYear,
    ...defaultEditionDates(currentYear),
    import_previous: true,
  });
  const [editingEdition, setEditingEdition] = useState(null);

  // Category & Nominee forms
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null); // { id, name }
  const [expandedCatId, setExpandedCatId] = useState(null);
  const [nomineeForm, setNomineeForm] = useState({
    categoryId: null,
    id: null,
    name: '',
    description: '',
    image_url: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Importador JSON
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importingJson, setImportingJson] = useState(false);

  const notify = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEditions = useCallback(async () => {
    const res = await apiFetch('/api/admin/editions');
    const list = res.editions || [];
    setEditions(list);
    if (list.length > 0) {
      setSelectedEditionId((prev) =>
        prev && list.some((e) => e.id === prev) ? prev : list[0].id
      );
    } else {
      setSelectedEditionId(null);
      setEditionDetail(null);
    }
  }, []);

  const loadEditionDetail = useCallback(async (edId) => {
    if (!edId) {
      setEditionDetail(null);
      return;
    }
    const res = await apiFetch(`/api/admin/editions/${edId}/categories`);
    setEditionDetail(res);
  }, []);

  useEffect(() => {
    apiFetch('/api/admin/me')
      .then(() => {
        setCheckingAuth(false);
        return loadEditions();
      })
      .catch(() => {
        navigate('/admin/login', { replace: true });
      });
  }, [navigate, loadEditions]);

  useEffect(() => {
    if (!checkingAuth && selectedEditionId) {
      loadEditionDetail(selectedEditionId);
    }
  }, [checkingAuth, selectedEditionId, loadEditionDetail]);

  const handleLogout = async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    navigate('/admin/login', { replace: true });
  };

  // --- Editions Actions ---

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
      await loadEditions();
      setSelectedEditionId(res.edition.id);
      setActiveTab('categories');
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
      await loadEditions();
      await loadEditionDetail(selectedEditionId);
      notify('Edição atualizada!');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleToggleFinished = async (edition) => {
    try {
      await apiFetch(`/api/admin/editions/${edition.id}`, {
        method: 'PUT',
        body: { is_finished: !edition.is_finished },
      });
      await loadEditions();
      await loadEditionDetail(edition.id);
      notify(!edition.is_finished ? 'Edição marcada como finalizada!' : 'Edição reaberta.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteEdition = async (id, year) => {
    if (!window.confirm(`Excluir toda a edição ${year} e seus votos?`)) return;
    try {
      await apiFetch(`/api/admin/editions/${id}`, { method: 'DELETE' });
      await loadEditions();
      notify(`Edição ${year} removida.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleImportPreviousCategories = async () => {
    if (!selectedEditionId) return;
    try {
      const res = await apiFetch(`/api/admin/editions/${selectedEditionId}/import-categories`, {
        method: 'POST',
        body: {},
      });
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
      notify(`${res.imported_count} categorias importadas!`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleImportJsonFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setImportJsonText(text);
  };

  const getImportPreview = () => {
    if (!importJsonText.trim()) return null;
    try {
      const parsed = JSON.parse(importJsonText);
      const cats = Array.isArray(parsed?.categories)
        ? parsed.categories
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!cats) return { error: 'Formato inválido: falta o array "categories".' };
      const nomineesTotal = cats.reduce(
        (sum, c) => sum + (Array.isArray(c?.nominees) ? c.nominees.length : 0),
        0
      );
      return { categoriesCount: cats.length, nomineesCount: nomineesTotal, payload: parsed };
    } catch {
      return { error: 'JSON inválido. Verifique a sintaxe.' };
    }
  };

  const handleSubmitImportJson = async (e) => {
    e.preventDefault();
    if (!selectedEditionId) return;
    const preview = getImportPreview();
    if (!preview || preview.error) {
      notify(preview?.error || 'Cole ou envie um arquivo JSON válido.', 'error');
      return;
    }

    setImportingJson(true);
    try {
      const res = await apiFetch(`/api/admin/editions/${selectedEditionId}/import-json`, {
        method: 'POST',
        body: preview.payload,
      });
      setImportModalOpen(false);
      setImportJsonText('');
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
      notify(
        `${res.categories_created} cat. criadas (${res.categories_reused} existentes) · ${res.nominees_created} indicados adicionados`
      );
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setImportingJson(false);
    }
  };

  // --- Categories Actions ---

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!selectedEditionId || !newCategoryName.trim()) return;
    try {
      const res = await apiFetch(`/api/admin/editions/${selectedEditionId}/categories`, {
        method: 'POST',
        body: { name: newCategoryName.trim() },
      });
      setNewCategoryName('');
      setExpandedCatId(res.category.id);
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveCategoryName = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await apiFetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PUT',
        body: { name: editingCategory.name },
      });
      setEditingCategory(null);
      await loadEditionDetail(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleMoveCategory = async (index, direction) => {
    const cats = editionDetail?.categories || [];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= cats.length) return;

    const reordered = [...cats];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    try {
      await apiFetch(`/api/admin/editions/${selectedEditionId}/categories/reorder`, {
        method: 'PUT',
        body: { orderedIds: reordered.map((c) => c.id) },
      });
      await loadEditionDetail(selectedEditionId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Excluir categoria e seus indicados?')) return;
    try {
      await apiFetch(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // --- Nominees Actions ---

  const handleUploadImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch('/api/admin/upload', {
        method: 'POST',
        body: fd,
      });
      setNomineeForm((prev) => ({ ...prev, image_url: res.url }));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveNominee = async (e) => {
    e.preventDefault();
    if (!nomineeForm.name.trim()) return;
    try {
      if (nomineeForm.id) {
        await apiFetch(`/api/admin/nominees/${nomineeForm.id}`, {
          method: 'PUT',
          body: {
            name: nomineeForm.name.trim(),
            description: nomineeForm.description.trim() || null,
            image_url: nomineeForm.image_url.trim() || null,
          },
        });
        notify('Indicado atualizado!');
      } else {
        await apiFetch(`/api/admin/categories/${nomineeForm.categoryId}/nominees`, {
          method: 'POST',
          body: {
            name: nomineeForm.name.trim(),
            description: nomineeForm.description.trim() || null,
            image_url: nomineeForm.image_url.trim() || null,
          },
        });
        notify('Indicado adicionado!');
      }
      setNomineeForm({ categoryId: nomineeForm.categoryId, id: null, name: '', description: '', image_url: '' });
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteNominee = async (nomineeId) => {
    try {
      await apiFetch(`/api/admin/nominees/${nomineeId}`, { method: 'DELETE' });
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // --- Winner Action ---

  const handleSetWinner = async (categoryId, nomineeId) => {
    try {
      await apiFetch(`/api/admin/categories/${categoryId}/winner`, {
        method: 'PUT',
        body: { nominee_id: nomineeId },
      });
      await loadEditionDetail(selectedEditionId);
      notify(nomineeId ? 'Vencedor oficial marcado!' : 'Vencedor removido.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteVoter = async (voterId, nickname) => {
    if (!window.confirm(`Remover os palpites de "${nickname}"?`)) return;
    try {
      await apiFetch(`/api/admin/voters/${voterId}`, { method: 'DELETE' });
      await loadEditionDetail(selectedEditionId);
      await loadEditions();
      notify(`Participante "${nickname}" removido.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
        </div>
      </div>
    );
  }

  const categories = editionDetail?.categories || [];
  const voters = editionDetail?.voters || [];
  const currentEdition = editionDetail?.edition || null;
  const decidedCount = categories.filter((c) => c.nominees.some((n) => n.is_winner)).length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pt-6">
        {toast && (
          <div
            className={`fixed right-4 top-16 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-xl ${
              toast.type === 'error'
                ? 'border-rose-500/40 bg-zinc-900 text-rose-300'
                : 'border-emerald-500/40 bg-zinc-900 text-emerald-300'
            }`}
          >
            {toast.type === 'error' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Painel <span className="text-amber-400">Admin</span>
            </h1>
            <p className="text-xs text-zinc-400">Edições, categorias, indicados e apuração</p>
          </div>

          <div className="flex items-center gap-2">
            {editions.length > 0 && (
              <select
                value={selectedEditionId || ''}
                onChange={(e) => setSelectedEditionId(Number(e.target.value))}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none focus:border-amber-500"
              >
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    TGA {ed.year} ({ed.categories_count} cat.)
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-zinc-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1.5">
          {[
            { id: 'categories', label: 'Categorias & Indicados', icon: ListChecks },
            { id: 'winners', label: 'Apuração (Ao Vivo)', icon: Award },
            { id: 'editions', label: 'Edições', icon: Calendar },
            { id: 'voters', label: `Participantes (${voters.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: EDITIONS */}
        {activeTab === 'editions' && (
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
                              <span className="text-base font-bold text-zinc-100">
                                TGA {ed.year}
                              </span>
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
        )}

        {/* TAB: CATEGORIES & NOMINEES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {!currentEdition ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
                <p className="text-sm text-zinc-400">Crie uma edição primeiro na aba Edições.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('editions')}
                  className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950"
                >
                  Criar Edição
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <form onSubmit={handleAddCategory} className="flex flex-1 gap-2">
                    <input
                      type="text"
                      placeholder="Nova categoria (ex: Game of the Year)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
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
                      <span>Importar do ano anterior</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    <span>Importar JSON</span>
                  </button>
                </div>

                {categories.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
                    Nenhuma categoria nesta edição. Adicione acima ou importe do ano anterior.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categories.map((cat, idx) => {
                      const isExpanded = expandedCatId === cat.id;
                      const isEditingName = editingCategory?.id === cat.id;
                      const isFormForThisCat = nomineeForm.categoryId === cat.id;

                      return (
                        <div
                          key={cat.id}
                          className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                            {isEditingName ? (
                              <form
                                onSubmit={handleSaveCategoryName}
                                className="flex flex-1 items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={editingCategory.name}
                                  onChange={(e) =>
                                    setEditingCategory((p) => ({ ...p, name: e.target.value }))
                                  }
                                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-sm"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-zinc-950"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCategory(null)}
                                  className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400"
                                >
                                  Cancelar
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = isExpanded ? null : cat.id;
                                  setExpandedCatId(next);
                                  if (next) {
                                    setNomineeForm({
                                      categoryId: next,
                                      id: null,
                                      name: '',
                                      description: '',
                                      image_url: '',
                                    });
                                  }
                                }}
                                className="flex flex-1 items-center gap-2.5 text-left"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-400">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-semibold text-zinc-100">
                                  {cat.name}
                                </span>
                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                  {cat.nominees.length} indicados
                                </span>
                              </button>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveCategory(idx, -1)}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                                title="Mover para cima"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === categories.length - 1}
                                onClick={() => handleMoveCategory(idx, 1)}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategory({ id: cat.id, name: cat.name })}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                title="Renomear"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-zinc-800 bg-zinc-950/60 p-4">
                              {/* Nominees List */}
                              {cat.nominees.length > 0 && (
                                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {cat.nominees.map((nom) => (
                                    <div
                                      key={nom.id}
                                      className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5"
                                    >
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        {nom.image_url ? (
                                          <img
                                            src={nom.image_url}
                                            alt={nom.name}
                                            className="h-10 w-10 shrink-0 rounded-lg object-cover bg-zinc-800"
                                          />
                                        ) : (
                                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500">
                                            <Gamepad2 className="h-4 w-4" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-semibold text-zinc-100">
                                            {nom.name}
                                          </p>
                                          {nom.description && (
                                            <p className="truncate text-[11px] text-zinc-400">
                                              {nom.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setNomineeForm({
                                              categoryId: cat.id,
                                              id: nom.id,
                                              name: nom.name,
                                              description: nom.description || '',
                                              image_url: nom.image_url || '',
                                            })
                                          }
                                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteNominee(nom.id)}
                                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add / Edit Nominee Form */}
                              <form
                                onSubmit={handleSaveNominee}
                                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
                              >
                                <p className="mb-2.5 text-xs font-semibold text-zinc-300">
                                  {isFormForThisCat && nomineeForm.id
                                    ? 'Editar Indicado'
                                    : 'Adicionar Indicado'}
                                </p>

                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    required
                                    placeholder="Nome do indicado *"
                                    value={isFormForThisCat ? nomineeForm.name : ''}
                                    onChange={(e) =>
                                      setNomineeForm((p) => ({
                                        ...p,
                                        categoryId: cat.id,
                                        name: e.target.value,
                                      }))
                                    }
                                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Descrição / Estúdio (opcional)"
                                    value={isFormForThisCat ? nomineeForm.description : ''}
                                    onChange={(e) =>
                                      setNomineeForm((p) => ({
                                        ...p,
                                        categoryId: cat.id,
                                        description: e.target.value,
                                      }))
                                    }
                                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
                                  />
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="URL da imagem ou envie um arquivo →"
                                    value={isFormForThisCat ? nomineeForm.image_url : ''}
                                    onChange={(e) =>
                                      setNomineeForm((p) => ({
                                        ...p,
                                        categoryId: cat.id,
                                        image_url: e.target.value,
                                      }))
                                    }
                                    className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
                                  />

                                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-amber-500/40">
                                    {uploadingImage ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Upload className="h-3.5 w-3.5" />
                                    )}
                                    <span>Upload</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        setNomineeForm((p) => ({ ...p, categoryId: cat.id }));
                                        handleUploadImage(e.target.files?.[0]);
                                      }}
                                    />
                                  </label>

                                  {isFormForThisCat && nomineeForm.id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNomineeForm({
                                          categoryId: cat.id,
                                          id: null,
                                          name: '',
                                          description: '',
                                          image_url: '',
                                        })
                                      }
                                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400"
                                    >
                                      Cancelar
                                    </button>
                                  )}

                                  <button
                                    type="submit"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>{isFormForThisCat && nomineeForm.id ? 'Salvar' : 'Adicionar'}</span>
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: WINNERS (APURAÇÃO AO VIVO) */}
        {activeTab === 'winners' && (
          <div className="space-y-4">
            {!currentEdition ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
                Nenhuma edição selecionada.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      Apuração TGA {currentEdition.year}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {decidedCount}/{categories.length} categorias com vencedor definido
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFinished(currentEdition)}
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

                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
                  >
                    <h3 className="mb-3 text-sm font-semibold text-zinc-100">{cat.name}</h3>
                    {cat.nominees.length === 0 ? (
                      <p className="text-xs text-zinc-500">Sem indicados cadastrados.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {cat.nominees.map((nom) => (
                          <button
                            key={nom.id}
                            type="button"
                            onClick={() =>
                              handleSetWinner(cat.id, nom.is_winner ? null : nom.id)
                            }
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
                              nom.is_winner
                                ? 'border-amber-500 bg-amber-500 text-zinc-950 font-bold'
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
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB: VOTERS */}
        {activeTab === 'voters' && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
            {voters.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Nenhum participante registrou palpites nesta edição ainda.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {voters.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100">{v.nickname}</p>
                      <p className="text-xs text-zinc-500">
                        Atualizado em {new Date(v.updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteVoter(v.id, v.nickname)}
                      className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400"
                      title="Remover participante"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Importar Categorias e Indicados via JSON */}
      {importModalOpen && currentEdition && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setImportModalOpen(false)}
        >
          <form
            onSubmit={handleSubmitImportJson}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  Importar Categorias e Indicados — TGA {currentEdition.year}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Categorias já existentes são reaproveitadas (apenas novos indicados são adicionados).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40">
                  <Upload className="h-3.5 w-3.5 text-amber-400" />
                  <span>Selecionar arquivo .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => handleImportJsonFile(e.target.files?.[0])}
                  />
                </label>

                {(() => {
                  const preview = getImportPreview();
                  if (!preview) return null;
                  if (preview.error) {
                    return <span className="text-xs font-medium text-rose-400">{preview.error}</span>;
                  }
                  return (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {preview.categoriesCount} categorias · {preview.nomineesCount} indicados
                    </span>
                  );
                })()}
              </div>

              <textarea
                rows={12}
                placeholder='Cole aqui o JSON gerado pelo script (ex: tga-2026-import.json)...'
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={importingJson || !importJsonText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {importingJson ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4" />
                )}
                <span>Importar agora</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
