import React, { useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Loader2, User } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import Modal from './ui/Modal';

export default function AccountModal({ open, onClose }) {
  const { user, changePassword, changeUsername } = useAuth();
  const [tab, setTab] = useState('profile'); // 'profile' | 'password'
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!open || !user) return null;

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await changeUsername(newUsername.trim());
      setFeedback({ type: 'success', text: 'Apelido atualizado em todas as edições!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'A confirmação da nova senha não confere.' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', text: 'Senha alterada com sucesso!' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={User}
      title="Minha Conta"
      subtitle={user.username}
      maxWidth="max-w-md"
    >
      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('profile');
            setNewUsername(user.username);
            setFeedback(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            tab === 'profile' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Apelido</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('password');
            setFeedback(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            tab === 'password' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Trocar Senha</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
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

      {tab === 'profile' ? (
        <form onSubmit={handleSaveUsername} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Novo nome de usuário / apelido no ranking
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={30}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Salvar apelido</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSavePassword} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Senha atual</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 pr-10 text-sm text-zinc-100 outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Nova senha</label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={4}
              maxLength={100}
              placeholder="Mínimo 4 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Confirmar nova senha
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={4}
              maxLength={100}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Atualizar senha</span>
          </button>
        </form>
      )}
    </Modal>
  );
}
