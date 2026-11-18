import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  LogIn,
  Save,
  UserCheck,
} from 'lucide-react';

export default function VotingBottomBar({
  edition,
  counts,
  user,
  isVotingOpen,
  isBeforeStart,
  isDirty,
  autoSaveEnabled,
  autoSaveStatus,
  onToggleAutoSave,
  saving,
  onSave,
  feedback,
}) {
  const redirectBack = edition ? `/?year=${edition.year}` : '/';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <div className="h-1 w-full bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${counts.progressPct}%` }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-3">
        {feedback && (
          <div
            className={`mb-2.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300'
                : feedback.type === 'info'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {isVotingOpen ? (
          user ? (
            <form
              onSubmit={onSave}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-zinc-400">
                  <span className="font-bold text-amber-400">{counts.complete}</span>/{counts.total}{' '}
                  completas ({counts.progressPct}%)
                </span>

                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <strong className="text-zinc-200">{user.username}</strong>
                </span>

                {isDirty ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    {autoSaveStatus === 'saving' ? 'Salvando...' : 'Alterações não salvas'}
                  </span>
                ) : autoSaveStatus === 'saved' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Salvo automaticamente
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={onToggleAutoSave}
                    className="h-3.5 w-3.5 accent-amber-500"
                  />
                  <span>Auto-save</span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Salvar Palpites</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-400">
                <span className="font-bold text-amber-400">{counts.complete}</span>/{counts.total}{' '}
                completas · Rascunho salvo localmente · Entre para enviar
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/entrar?mode=register&redirect=${encodeURIComponent(redirectBack)}`}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40"
                >
                  Criar conta
                </Link>
                <Link
                  to={`/entrar?redirect=${encodeURIComponent(redirectBack)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Entrar para salvar</span>
                </Link>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-zinc-500" />
              {isBeforeStart
                ? 'Votação ainda não iniciada.'
                : 'Votação encerrada. Modo somente leitura.'}
            </span>
            <Link
              to={`/ranking?year=${edition.year}`}
              className="rounded-lg bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-400 transition hover:bg-amber-500/25"
            >
              Ver Ranking →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
