import React, { useState } from 'react';
import { FileJson, Loader2, Upload } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import Modal from '../ui/Modal';

export default function ImportJsonModal({
  open,
  onClose,
  currentEdition,
  selectedEditionId,
  onReload,
  notify,
}) {
  const [importJsonText, setImportJsonText] = useState('');
  const [importingJson, setImportingJson] = useState(false);

  if (!open || !currentEdition) return null;

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

  const handleSubmit = async () => {
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
      setImportJsonText('');
      onClose();
      await onReload(selectedEditionId);
      notify(
        `${res.categories_created} cat. criadas (${res.categories_reused} existentes) · ${res.nominees_created} indicados adicionados`
      );
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setImportingJson(false);
    }
  };

  const preview = getImportPreview();

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={FileJson}
      title={`Importar Categorias e Indicados — TGA ${currentEdition.year}`}
      subtitle="Categorias já existentes são reaproveitadas (apenas novos indicados são adicionados)."
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
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
        </>
      }
    >
      <div className="space-y-3">
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

          {preview &&
            (preview.error ? (
              <span className="text-xs font-medium text-rose-400">{preview.error}</span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                {preview.categoriesCount} categorias · {preview.nomineesCount} indicados
              </span>
            ))}
        </div>

        <textarea
          rows={12}
          placeholder="Cole aqui o JSON gerado pelo script (ex: tga-2026-import.json)..."
          value={importJsonText}
          onChange={(e) => setImportJsonText(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
      </div>
    </Modal>
  );
}
