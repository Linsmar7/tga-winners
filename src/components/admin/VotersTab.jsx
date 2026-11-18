import React, { useState } from 'react';
import { Trash2, KeyRound, Check, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export default function VotersTab({
  voters = [],
  users = [],
  selectedEditionId,
  onReload,
  notify,
}) {
  const [resetTarget, setResetTarget] = useState(null); // { id, username }
  const [newPassword, setNewPassword] = useState('');

  const handleDeleteVoter = async (voterId, nickname) => {
    if (!window.confirm(`Remover os palpites de "${nickname}" nesta edição?`)) return;
    try {
      await apiFetch(`/api/admin/voters/${voterId}`, { method: 'DELETE' });
      await onReload(selectedEditionId);
      notify(`Participante "${nickname}" removido.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget || newPassword.length < 4) return;
    try {
      await apiFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'PUT',
        body: { new_password: newPassword },
      });
      notify(`Senha de "${resetTarget.username}" redefinida com sucesso!`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Participantes desta edição */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-bold text-zinc-100">
            Palpites desta Edição ({voters.length})
          </h2>
        </div>

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
                  title="Remover participante da edição"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contas de Usuários (Reset de Senha) */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-bold text-zinc-100">
            Contas Cadastradas ({users.length})
          </h2>
          <p className="text-xs text-zinc-400">
            Redefina a senha de um amigo caso ele esqueça o acesso
          </p>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Nenhuma conta cadastrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {users.map((u) => {
              const isResetting = resetTarget?.id === u.id;
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-zinc-100">{u.username}</p>
                    <p className="text-xs text-zinc-500">
                      Criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {isResetting ? (
                    <form onSubmit={handleResetPassword} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        required
                        minLength={4}
                        placeholder="Nova senha (min 4)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-amber-500 p-1.5 text-zinc-950 hover:bg-amber-400"
                        title="Confirmar nova senha"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(null);
                          setNewPassword('');
                        }}
                        className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget({ id: u.id, username: u.username });
                        setNewPassword('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Resetar senha</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
