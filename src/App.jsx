import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './lib/AuthContext';
import Home from './pages/Home';

const Ranking = lazy(() => import('./pages/Ranking'));
const History = lazy(() => import('./pages/History'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function PageFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-400">
      <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
      <p className="mt-3 text-xs">Carregando...</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/historico" element={<History />} />
          <Route path="/entrar" element={<AuthPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
