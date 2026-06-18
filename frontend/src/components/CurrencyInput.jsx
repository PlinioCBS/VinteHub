import React, { useState, useEffect } from 'react';

/**
 * CurrencyInput
 * - Exibe valor formatado como R$ 1.000,00 ao perder o foco
 * - Permite edição livre ao focar
 * - Chama onChange(numero) com o valor numérico
 */
export default function CurrencyInput({ value, onChange, placeholder = 'R$ 0,00', disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  function fmt(n) {
    if (!n && n !== 0) return '';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseValue(str) {
    // remove tudo exceto dígitos e vírgula/ponto
    const cleaned = str.replace(/[^\d,\.]/g, '');
    // substitui vírgula decimal por ponto
    const normalized = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  function handleFocus() {
    setEditing(true);
    setRaw(value ? String(value) : '');
  }

  function handleBlur() {
    setEditing(false);
    const num = parseValue(raw);
    onChange(num);
  }

  return (
    <input
      type={editing ? 'text' : 'text'}
      value={editing ? raw : fmt(value)}
      onChange={e => setRaw(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
      style={{ borderColor: '#d9d9d6', color: 'var(--text-primary)', backgroundColor: disabled ? 'var(--bg-page)' : 'var(--bg-card)' }}
      onFocusCapture={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
      onBlurCapture={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
    />
  );
}
