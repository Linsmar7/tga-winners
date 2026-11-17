import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart3, Shield, Vote } from 'lucide-react';

export default function Navbar({ editions = [], selectedYear, onSelectYear }) {
  const location = useLocation();
  const isRanking = location.pathname === '/ranking';
  const isAdmin = location.pathname.startsWith('/admin');

  const yearQuery = selectedYear ? `?year=${selectedYear}` : '';

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          to={`/${yearQuery}`}
          className="flex items-center gap-2 font-bold tracking-tight text-zinc-100 transition hover:text-amber-400"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="text-sm sm:text-base">
            TGA <span className="text-amber-400">Winners</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {editions.length > 0 && !isAdmin && onSelectYear && (
            <select
              aria-label="Selecionar edição"
              value={selectedYear || ''}
              onChange={(e) => onSelectYear(Number(e.target.value))}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 outline-none transition focus:border-amber-500"
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
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                !isRanking && !isAdmin
                  ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              <Vote className="h-4 w-4" />
              <span>Palpites</span>
            </Link>

            <Link
              to={`/ranking${yearQuery}`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                isRanking
                  ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Ranking</span>
            </Link>

            <Link
              to="/admin"
              title="Painel Admin"
              className={`flex items-center justify-center rounded-lg p-1.5 transition sm:px-2.5 sm:py-1.5 ${
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
  );
}
