import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      setUser(res.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (username, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setUser(res.user);
    return res.user;
  };

  const register = async (username, password) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    });
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loadingAuth, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
