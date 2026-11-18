import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Dices, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const QUICK_SUGGESTIONS = [
  { question: 'Vai aparecer trailer de Half-Life 3?', options: ['Sim', 'Não'], points: 3 },
  {
    question: 'Algum discurso vai ser cortado pela música do "Please Wrap It Up"?',
    options: ['Sim', 'Não'],
    points: 2,
  },
  {
    question: 'Quantos prêmios o vencedor de GOTY vai levar no total?',
    options: ['1 a 2', '3 a 4', '5 ou mais'],
    points: 4,
  },
  { question: 'Vai ter anúncio surpresa da FromSoftware?', options: ['Sim', 'Não'], points: 3 },
];

export default function SideBetsTab({
  currentEdition,
  sideBets = [],
  selectedEditionId,
  onReload,
  notify,
}) {
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('Sim, Não');
  const [points, setPoints] = useState(3);

  if (!currentEdition) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        Nenhuma edição selecionada.
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    const options = optionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiFetch(`/api/admin/editions/${selectedEditionId}/side-bets`, {
        method: 'POST',
        body: { question: question.trim(), options, points: Number(points) || 3 },
      });
      setQuestion('');
      setOptionsText('Sim, Não');
      setPoints(3);
      await onReload(selectedEditionId);
      notify('Palpite extra criado!');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAddSuggestion = async (sug) => {
    try {
      await apiFetch(`/api/admin/editions/${selectedEditionId}/side-bets`, {
        method: 'POST',
        body: sug,
      });
      await onReload(selectedEditionId);
      notify('Sugestão adicionada ao Bingo!');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSetAnswer = async (sbId, option) => {
    try {
      await apiFetch(`/api/admin/side-bets/${sbId}/answer`, {
        method: 'PUT',
        body: { correct_option: option },
      });
      await onReload(selectedEditionId);
      notify(option ? `Resposta oficial definida: ${option}` : 'Resposta removida.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (sbId) => {
    if (!window.confirm('Excluir este palpite extra?')) return;
    try {
      await apiFetch(`/api/admin/side-bets/${sbId}`, { method: 'DELETE' });
      await onReload(selectedEditionId);
      notify('Palpite extra removido.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5"
      >
        <div className="flex items-center gap-2">
          <Dices className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-zinc-100">
            Novo Palpite Extra / Bingo — TGA {currentEdition.year}
          </h2>
        </div>

        <input
          type="text"
          required
          placeholder="Pergunta (ex: Half-Life 3 vai aparecer no evento?)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <div className="sm:col-span-8">
            <label className="mb-1 block text-[11px] text-zinc-400">
              Opções separadas por vírgula
            </label>
            <input
              type="text"
              required
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] text-zinc-400">Pontos</label>
            <input
              type="number"
              min={1}
              max={50}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-xs font-bold text-amber-300 outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              <span>Criar</span>
            </button>
          </div>
        </div>

        {/* Quick Templates */}
        <div className="pt-1">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] text-zinc-500">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Sugestões rápidas (clique para adicionar):</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAddSuggestion(sug)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                + {sug.question}
              </button>
            ))}
          </div>
        </div>
      </form>

      {sideBets.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
          Nenhum palpite extra criado nesta edição ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {sideBets.map((sb) => (
            <div
              key={sb.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{sb.question}</h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Vale <strong className="text-amber-400">+{sb.points} pts</strong> · Clique na
                    opção vencedora para apurar ao vivo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(sb.id)}
                  className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {sb.options.map((opt) => {
                  const isCorrect = sb.correct_option === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSetAnswer(sb.id, isCorrect ? null : opt)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-500 text-zinc-950 font-bold'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-emerald-500/40'
                      }`}
                    >
                      {isCorrect && <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
