import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('vinte_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const validate = useCallback(async () => {
    const token = localStorage.getItem('vinte_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch('/auth/me');
      setUser(me);
    } catch {
      localStorage.removeItem('vinte_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    validate();
  }, [validate]);

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    localStorage.setItem('vinte_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('vinte_token');
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch('/auth/me');
      setUser(me);
    } catch {
      // silently ignore
    }
  }, []);

  const isAuthenticated = !!user;
  const isMaster = user?.role === 'master';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated, isMaster, refreshUser }}>
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
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f5f0e8' }}>
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
