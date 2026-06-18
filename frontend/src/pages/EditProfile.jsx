import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useAPI from '../hooks/useAPI.js';

export default function EditProfile() {
  const { user, refreshUser } = useAuth();
  const api = useAPI();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // Dados pessoais
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Foto
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || user?.photo_url || null);

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setLoadingPhoto(true);
    try {
      await api.uploadUserPhoto(user._id, file);
      toast.success('Foto atualizada com sucesso!');
    } catch (err) {
      toast.error(err.message);
      setPhotoPreview(user?.photoUrl || null);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setLoadingPhoto(true);
    try {
      await api.deleteUserPhoto(user._id);
      setPhotoPreview(null);
      toast.success('Foto removida.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Nome não pode ser vazio'); return; }
    setLoadingProfile(true);
    try {
      const result = await api.updateProfile({ name: name.trim(), email: email.trim() });
      if (!result.success) throw new Error('Erro ao atualizar perfil');
      // Update localStorage so refreshUser picks up the new data
      const stored = JSON.parse(localStorage.getItem('vinte_user') || '{}');
      localStorage.setItem('vinte_user', JSON.stringify({ ...stored, name: name.trim(), email: email.trim() }));
      refreshUser();
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar perfil');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return; }
    if (newPassword.length < 6) { toast.error('A senha deve ter ao menos 6 caracteres'); return; }
    setLoadingPassword(true);
    try {
      const result = await api.changePassword({ currentPassword, newPassword });
      if (!result.success) throw new Error(result.error || 'Senha atual incorreta');
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingPassword(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 font-sans text-sm outline-none";
  const focusStyle = {
    onFocus: e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564120'; },
    onBlur: e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; },
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-serif font-bold text-2xl text-gray-900">Editar Perfil</h1>
          <p className="font-sans text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Foto de perfil */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-5">Foto de Perfil</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {photoPreview ? (
              <img src={photoPreview} alt={user?.name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-serif font-bold text-2xl" style={{ backgroundColor: '#dd7752', color: 'white' }}>
                {initials}
              </div>
            )}
            {loadingPhoto && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40">
                <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
            <button onClick={() => fileRef.current?.click()} disabled={loadingPhoto}
              className="px-4 py-2 rounded-xl font-sans text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#355641' }}>
              {photoPreview ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {photoPreview && (
              <button onClick={handleRemovePhoto} disabled={loadingPhoto}
                className="block px-4 py-2 rounded-xl font-sans text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-50">
                Remover foto
              </button>
            )}
            <p className="font-sans text-xs text-gray-400">JPG, PNG ou WebP · máx. 2 MB</p>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-5">Dados Pessoais</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">Nome</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className={inputClass} {...focusStyle} disabled={loadingProfile} />
          </div>
          <div>
            <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass} {...focusStyle} disabled={loadingProfile} />
          </div>
          <button type="submit" disabled={loadingProfile || (!name.trim())}
            className="w-full py-3 rounded-xl font-sans font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#355641' }}>
            {loadingProfile ? 'Salvando...' : 'Salvar dados'}
          </button>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-5">Alterar Senha</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">Senha atual</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className={inputClass + ' pr-12'} {...focusStyle} disabled={loadingPassword} />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon show={showCurrent} />
              </button>
            </div>
          </div>
          <div>
            <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">Nova senha</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                className={inputClass + ' pr-12'} {...focusStyle} disabled={loadingPassword} />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon show={showNew} />
              </button>
            </div>
          </div>
          <div>
            <label className="block font-sans text-sm font-medium text-gray-700 mb-1.5">Confirmar nova senha</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" className={inputClass} {...focusStyle} disabled={loadingPassword} />
          </div>
          <button type="submit"
            disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full py-3 rounded-xl font-sans font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#dd7752' }}>
            {loadingPassword ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EyeIcon({ show }) {
  return show ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
