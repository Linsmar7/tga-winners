import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  LogOut,
  Loader2,
  Check,
  Calendar,
  ListChecks,
  Users,
  X,
  Dices,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import EditionsTab from '../components/admin/EditionsTab';
import CategoriesTab from '../components/admin/CategoriesTab';
import WinnersTab from '../components/admin/WinnersTab';
import SideBetsTab from '../components/admin/SideBetsTab';
import VotersTab from '../components/admin/VotersTab';
import ImportJsonModal from '../components/admin/ImportJsonModal';
import { apiFetch } from '../lib/api';

export default function AdminPanel() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [editions, setEditions] = useState([]);
  const [selectedEditionId, setSelectedEditionId] = useState(null);
  const [editionDetail, setEditionDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('categories'); // 'editions' | 'categories' | 'winners' | 'side_bets' | 'voters'
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const notify = useCallback((text, type = 'success') => {
    clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    return () => clearTimeout(toastTimerRef.current);
  }, []);

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

  const reloadAll = useCallback(
    async (edId) => {
      await loadEditions();
      if (edId) {
        await loadEditionDetail(edId);
      }
    },
    [loadEditions, loadEditionDetail]
  );

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
  const sideBets = editionDetail?.side_bets || [];
  const voters = editionDetail?.voters || [];
  const users = editionDetail?.users || [];
  const currentEdition = editionDetail?.edition || null;

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
            <p className="text-xs text-zinc-400">
              Edições, categorias, indicados, bingo e apuração ao vivo
            </p>
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
            { id: 'side_bets', label: `Bingo / Extras (${sideBets.length})`, icon: Dices },
            { id: 'editions', label: 'Edições & Backup', icon: Calendar },
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

        {activeTab === 'editions' && (
          <EditionsTab
            editions={editions}
            selectedEditionId={selectedEditionId}
            onSelectEdition={setSelectedEditionId}
            onReload={reloadAll}
            onSwitchToCategories={() => setActiveTab('categories')}
            notify={notify}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesTab
            currentEdition={currentEdition}
            editions={editions}
            categories={categories}
            selectedEditionId={selectedEditionId}
            onReload={reloadAll}
            onOpenImportModal={() => setImportModalOpen(true)}
            onSwitchToEditions={() => setActiveTab('editions')}
            notify={notify}
          />
        )}

        {activeTab === 'winners' && (
          <WinnersTab
            currentEdition={currentEdition}
            categories={categories}
            selectedEditionId={selectedEditionId}
            onReload={reloadAll}
            notify={notify}
          />
        )}

        {activeTab === 'side_bets' && (
          <SideBetsTab
            currentEdition={currentEdition}
            sideBets={sideBets}
            selectedEditionId={selectedEditionId}
            onReload={reloadAll}
            notify={notify}
          />
        )}

        {activeTab === 'voters' && (
          <VotersTab
            voters={voters}
            users={users}
            selectedEditionId={selectedEditionId}
            onReload={reloadAll}
            notify={notify}
          />
        )}
      </main>

      <ImportJsonModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        currentEdition={currentEdition}
        selectedEditionId={selectedEditionId}
        onReload={reloadAll}
        notify={notify}
      />
    </div>
  );
}
