import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus, Loader2, Trophy, Eye, EyeOff } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../lib/AuthContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  const { user, loadingAuth, login, register } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate(redirect, { replace: true });
    }
  }, [loadingAuth, user, navigate, redirect]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas digitadas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(username, password);
      } else {
        await login(username, password);
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />

      <main className="mx-auto flex max-w-md flex-col px-4 pt-12">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-zinc-100">
                {mode === 'register' ? 'Criar Conta' : 'Entrar no Bolão'}
              </h1>
              <p className="text-xs text-zinc-400">
                Seu nome de usuário aparecerá no ranking
              </p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar conta
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Usuário</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={30}
                autoComplete="username"
                placeholder="ex: Linsmar"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={100}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder="Mínimo 4 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Confirmar senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={100}
                  autoComplete="new-password"
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'register' ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              <span>{mode === 'register' ? 'Cadastrar e continuar' : 'Entrar'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
