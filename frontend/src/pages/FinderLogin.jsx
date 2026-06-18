import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAPI from '../hooks/useAPI.js';

export default function FinderLogin() {
  const api = useAPI();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If already logged in as finder, go to portal
    const token = localStorage.getItem('finder_token');
    if (token) navigate('/finder-portal', { replace: true });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.finderLogin(email.trim(), password);
      if (!res.success) { setError(res.error || 'Credenciais inválidas'); return; }
      localStorage.setItem('finder_token', res.finder._id);
      localStorage.setItem('finder_data', JSON.stringify(res.finder));
      navigate('/finder-portal', { replace: true });
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f4f2' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#355641' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: '#353535' }}>Portal do Finder</h1>
          <p className="font-sans text-sm mt-1" style={{ color: '#9ca3af' }}>Área exclusiva para parceiros indicadores</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                style={{ color: '#353535' }}
                onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                style={{ color: '#353535' }}
                onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-xl text-sm font-sans" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90 mt-2"
              style={{ backgroundColor: '#355641' }}
            >
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>
          </form>
        </div>

        <p className="text-center font-sans text-xs mt-4" style={{ color: '#9ca3af' }}>
          Este portal é exclusivo para parceiros. Para acessar o CRM,{' '}
          <a href="/login" className="underline" style={{ color: '#355641' }}>clique aqui</a>.
        </p>
      </div>
    </div>
  );
}
