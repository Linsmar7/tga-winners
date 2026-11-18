import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart3, Shield, Vote, LogIn, LogOut, User, Crown } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import AccountModal from './AccountModal';

export default function Navbar({ editions = [], selectedYear, onSelectYear }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  const isRanking = location.pathname === '/ranking';
  const isHistory = location.pathname === '/historico';
  const isAdmin = location.pathname.startsWith('/admin');
  const isAuth = location.pathname === '/entrar';

  const yearQuery = selectedYear ? `?year=${selectedYear}` : '';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Link
            to={`/${yearQuery}`}
            className="flex items-center gap-2 font-bold tracking-tight text-zinc-100 transition hover:text-amber-400"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <Trophy className="h-4 w-4" />
            </span>
            <span className="hidden text-sm sm:inline sm:text-base">
              TGA <span className="text-amber-400">Winners</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {editions.length > 0 && !isAdmin && !isAuth && !isHistory && onSelectYear && (
              <select
                aria-label="Selecionar edição"
                value={selectedYear || ''}
                onChange={(e) => onSelectYear(Number(e.target.value))}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-zinc-200 outline-none transition focus:border-amber-500 sm:px-2.5"
              >
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.year}>
                    {ed.year}
                  </option>
                ))}
              </select>
            )}

            <nav className="flex items-center gap-1">
              <Link
                to={`/${yearQuery}`}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  !isRanking && !isHistory && !isAdmin && !isAuth
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <Vote className="h-4 w-4" />
                <span className="hidden sm:inline">Palpites</span>
              </Link>

              <Link
                to={`/ranking${yearQuery}`}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  isRanking
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Ranking</span>
              </Link>

              <Link
                to="/historico"
                title="Hall da Fama"
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  isHistory
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <Crown className="h-4 w-4" />
                <span className="hidden md:inline">Histórico</span>
              </Link>

              {!isAdmin &&
                (user ? (
                  <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/80 pl-1.5 pr-1 py-1 text-xs text-zinc-200">
                    <button
                      type="button"
                      onClick={() => setAccountOpen(true)}
                      title="Gerenciar conta e senha"
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 transition hover:bg-zinc-800"
                    >
                      <User className="h-3.5 w-3.5 text-amber-400" />
                      <span className="max-w-[72px] truncate font-medium sm:max-w-[110px]">
                        {user.username}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      title="Sair da conta"
                      className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/entrar"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                      isAuth
                        ? 'bg-amber-500 text-zinc-950'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-amber-500/40 hover:text-amber-300'
                    }`}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Entrar</span>
                  </Link>
                ))}

              <Link
                to="/admin"
                title="Painel Admin"
                className={`flex items-center justify-center rounded-lg p-1.5 transition sm:px-2 sm:py-1.5 ${
                  isAdmin
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Shield className="h-4 w-4" />
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
