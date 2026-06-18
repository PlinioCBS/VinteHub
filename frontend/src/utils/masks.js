// Máscaras de input padronizadas (Brasil)

// Telefone BR — aceita fixo (10 dígitos) e celular (11 dígitos), limita em 11.
// Formatos: (11) 1234-5678  /  (11) 91234-5678
export function maskPhone(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// CPF — 000.000.000-00 (limita em 11 dígitos)
export function maskCPF(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Regimes tributários (Brasil)
export const TAX_REGIMES = [
  { value: 'pessoa_fisica',    label: 'Pessoa Física' },
  { value: 'mei',              label: 'MEI' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido',  label: 'Lucro Presumido' },
  { value: 'lucro_real',       label: 'Lucro Real' },
];
