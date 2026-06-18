import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Informe o email');
    if (!password) return setError('Informe a senha');

    setLoading(true);
    try {
      await login(email.trim(), password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left - Brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: '#355641' }}
      >
        {/* Animated floating shapes */}
        <style>{`
          @keyframes float1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(20px, -30px) scale(1.05); }
          }
          @keyframes float2 {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            50% { transform: translate(-15px, 20px) rotate(15deg); }
          }
          @keyframes float3 {
            0%, 100% { transform: translate(0, 0) scale(1.1); }
            50% { transform: translate(25px, 15px) scale(0.95); }
          }
          .shape1 { animation: float1 8s ease-in-out infinite; }
          .shape2 { animation: float2 11s ease-in-out infinite; }
          .shape3 { animation: float3 14s ease-in-out infinite; }
        `}</style>

        {/* Background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="shape1 absolute w-80 h-80 rounded-full opacity-10"
            style={{ backgroundColor: '#dd7752', top: '-10%', left: '-10%' }} />
          <div className="shape2 absolute w-64 h-64 rounded-full opacity-10"
            style={{ backgroundColor: 'var(--bg-page)', bottom: '5%', right: '-8%' }} />
          <div className="shape3 absolute w-48 h-48 rounded-full opacity-5"
            style={{ backgroundColor: '#dd7752', top: '40%', left: '60%' }} />
          <div className="shape1 absolute w-32 h-32 rounded-full opacity-10"
            style={{ backgroundColor: 'var(--bg-page)', bottom: '30%', left: '5%', animationDelay: '2s' }} />
        </div>

        {/* Logo and tagline */}
        <div className="relative z-10 text-center px-12">
          <div className="mb-8">
            <img
              src="/Logo_Vinte_white.png"
              alt="Vinte Hub"
              className="h-60 w-auto object-contain mx-auto drop-shadow-2xl"
            />
          </div>
          <p className="font-sans text-white/70 text-lg tracking-wide mt-2">
            Inteligência e Gestão para os Consultores
          </p>
          <div className="mt-10 w-16 h-0.5 mx-auto" style={{ backgroundColor: '#dd7752' }} />
          <p className="font-sans text-white/40 text-sm mt-6 leading-relaxed max-w-sm mx-auto">
            Plataforma integrada para gestão de clientes, pipeline e performance de investimentos.
          </p>
        </div>
      </div>

      {/* Right - Login form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ backgroundColor: 'var(--bg-page)' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <img
              src="/Logo_Vinte_green.png"
              alt="Vinte Hub"
              className="h-24 w-auto object-contain mx-auto mb-2"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="font-serif font-bold text-2xl mb-1" style={{ color: '#1a1a1a' }}>
              Bem-vindo de volta
            </h2>
            <p className="font-sans text-sm text-gray-500 mb-8">
              Acesse sua conta para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all duration-200 focus:ring-2"
                  style={{ '--tw-ring-color': '#35564133' }}
                  onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564120'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all duration-200"
                    onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564120'; }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-sans"
                  style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-sans font-semibold text-white text-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#dd7752' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : 'Entrar'}
              </button>
            </form>
          </div>

          <p className="text-center font-sans text-xs text-gray-400 mt-6">
            Vinte Hub CRM · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
