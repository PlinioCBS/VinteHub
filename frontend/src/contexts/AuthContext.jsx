import React, { createContext, useContext, useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/browserApi';

const AuthContext = createContext(null);

const STORAGE_KEY = 'vinte_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading] = useState(false);

  const loginMutation = useMutation(api.auth.login);
  const finderLoginMutation = useMutation(api.auth.finderLogin);

  const login = async (email, password) => {
    const result = await loginMutation({ email, password });
    if (!result.success) throw new Error(result.error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
    return result.user;
  };

  const finderLogin = async (email, password) => {
    const result = await finderLoginMutation({ email, password });
    if (!result.success) throw new Error(result.error);
    const finderUser = { ...result.finder, role: 'finder' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finderUser));
    setUser(finderUser);
    return finderUser;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const refreshUser = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const isAuthenticated = !!user;
  const isMaster = user?.role === 'master';

  return (
    <AuthContext.Provider value={{ user, loading, login, finderLogin, logout, isAuthenticated, isMaster, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#355641', borderTopColor: 'transparent' }} />
          <p className="font-sans text-sm" style={{ color: '#355641' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return children;
}
