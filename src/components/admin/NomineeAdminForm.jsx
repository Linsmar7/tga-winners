import React, { useState } from 'react';
import { Loader2, Plus, Upload, Wand2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const INITIAL_FORM = {
  id: null,
  name: '',
  description: '',
  image_url: '',
  external_url: '',
  kind: 'game',
};

export default function NomineeAdminForm({
  categoryId,
  editingNominee,
  onClearEditing,
  onSaved,
  notify,
}) {
  const [form, setForm] = useState(() =>
    editingNominee
      ? {
          id: editingNominee.id,
          name: editingNominee.name || '',
          description: editingNominee.description || '',
          image_url: editingNominee.image_url || '',
          external_url: editingNominee.external_url || '',
          kind: 'game',
        }
      : INITIAL_FORM
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  React.useEffect(() => {
    if (editingNominee) {
      setForm({
        id: editingNominee.id,
        name: editingNominee.name || '',
        description: editingNominee.description || '',
        image_url: editingNominee.image_url || '',
        external_url: editingNominee.external_url || '',
        kind: 'game',
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [editingNominee]);

  const handleUploadImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
      setForm((prev) => ({ ...prev, image_url: res.url }));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAutoLookupMedia = async () => {
    const name = form.name.trim();
    if (!name) {
      notify('Digite o nome do indicado primeiro para buscar a capa.', 'error');
      return;
    }
    setLookingUp(true);
    try {
      const res = await apiFetch('/api/admin/nominees/lookup', {
        method: 'POST',
        body: { name, kind: form.kind || 'game' },
      });
      if (!res.image_url && !res.external_url) {
        notify('Nenhuma capa encontrada automaticamente.', 'error');
      } else {
        setForm((prev) => ({
          ...prev,
          image_url: res.image_url || prev.image_url,
          external_url: res.external_url || prev.external_url,
        }));
        notify(res.image_url ? 'Capa encontrada!' : 'Link encontrado (sem imagem).');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      external_url: form.external_url.trim() || null,
    };

    try {
      if (form.id) {
        await apiFetch(`/api/admin/nominees/${form.id}`, {
          method: 'PUT',
          body: payload,
        });
        notify('Indicado atualizado!');
      } else {
        await apiFetch(`/api/admin/categories/${categoryId}/nominees`, {
          method: 'POST',
          body: payload,
        });
        notify('Indicado adicionado!');
      }
      setForm(INITIAL_FORM);
      onClearEditing?.();
      await onSaved();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-300">
          {form.id ? 'Editar Indicado' : 'Adicionar Indicado'}
        </p>
        <div className="flex items-center gap-1.5">
          <select
            value={form.kind}
            onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
          >
            <option value="game">Jogo</option>
            <option value="person">Pessoa/Ator</option>
            <option value="mobile">Mobile</option>
            <option value="media">Série/Filme</option>
          </select>
          <button
            type="button"
            disabled={lookingUp}
            onClick={handleAutoLookupMedia}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
          >
            {lookingUp ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            <span>Buscar capa</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input
          type="text"
          required
          placeholder="Nome do indicado *"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
        />
        <input
          type="text"
          placeholder="Descrição / Estúdio (opcional)"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
        />
      </div>

      <input
        type="url"
        placeholder="Link externo opcional (Steam / Trailer YouTube)"
        value={form.external_url}
        onChange={(e) => setForm((p) => ({ ...p, external_url: e.target.value }))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="URL da imagem ou envie um arquivo →"
          value={form.image_url}
          onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
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
            onChange={(e) => handleUploadImage(e.target.files?.[0])}
          />
        </label>

        {form.id && (
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL_FORM);
              onClearEditing?.();
            }}
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
          <span>{form.id ? 'Salvar' : 'Adicionar'}</span>
        </button>
      </div>
    </form>
  );
}
