import React, { useState, useRef } from 'react';
import Modal from './Modal.jsx';
import useAPI from '../hooks/useAPI.js';

const CONTACT_FIELDS = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'company', label: 'Empresa' },
  { key: 'status', label: 'Status' },
  { key: 'aum', label: 'AUM' },
  { key: 'notes', label: 'Notas' },
  { key: 'investor_profile', label: 'Perfil Investidor' },
  { key: 'portfolio', label: 'Carteira' },
  { key: 'liquidity_horizon', label: 'Horizonte Liquidez' },
  { key: '__skip__', label: '— Ignorar coluna —' }
];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line =>
    line.split(sep).map(cell => cell.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
}

function autoDetect(header) {
  const h = header.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (h.includes('nome') || h.includes('name')) return 'name';
  if (h.includes('email') || h.includes('e-mail')) return 'email';
  if (h.includes('tel') || h.includes('fone') || h.includes('celular') || h.includes('phone')) return 'phone';
  if (h.includes('empresa') || h.includes('company')) return 'company';
  if (h.includes('status')) return 'status';
  if (h.includes('aum') || h.includes('patrimonio') || h.includes('capital')) return 'aum';
  if (h.includes('nota') || h.includes('obs')) return 'notes';
  if (h.includes('perfil') || h.includes('profile')) return 'investor_profile';
  if (h.includes('carteira') || h.includes('portfolio')) return 'portfolio';
  return '__skip__';
}

export default function ImportModal({ open, onClose, onSuccess }) {
  const api = useAPI();
  const [step, setStep] = useState(1); // 1=upload, 2=mapping, 3=result
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  function handleClose() {
    setStep(1); setParsed(null); setMapping({}); setResult(null);
    onClose();
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const p = parseCSV(ev.target.result);
      setParsed(p);
      const auto = {};
      p.headers.forEach(h => { auto[h] = autoDetect(h); });
      setMapping(auto);
      setStep(2);
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleImport() {
    setImporting(true);
    try {
      const contacts = parsed.rows.map(row => {
        const obj = {};
        parsed.headers.forEach((h, i) => {
          const field = mapping[h];
          if (field && field !== '__skip__') obj[field] = row[i];
        });
        return obj;
      }).filter(c => c.name);

      const res = await api.importContacts(contacts);
      setResult(res);
      setStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar Contatos (CSV)" size="lg">
      {step === 1 && (
        <div className="text-center py-10">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-charcoal/60 mb-6 font-sans">Selecione um arquivo CSV com seus contatos. A detecção de colunas é automática.</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current.click()} className="btn-primary">
            Escolher arquivo CSV
          </button>
          <p className="text-xs text-charcoal/40 mt-4">Separadores: vírgula ou ponto e vírgula</p>
        </div>
      )}

      {step === 2 && parsed && (
        <div>
          <div className="mb-4 p-3 bg-cream rounded-lg text-sm text-charcoal/70">
            <strong>{parsed.rows.length}</strong> linhas detectadas · <strong>{parsed.headers.length}</strong> colunas
          </div>

          {/* Column mapping */}
          <div className="mb-4">
            <p className="label mb-2">Mapeamento de Colunas</p>
            <div className="space-y-2">
              {parsed.headers.map(h => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-sm text-charcoal w-40 truncate font-sans">{h}</span>
                  <svg className="w-4 h-4 text-charcoal/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <select
                    value={mapping[h] || '__skip__'}
                    onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                    className="input-field text-sm flex-1"
                  >
                    {CONTACT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4 overflow-x-auto">
            <p className="label mb-2">Preview (primeiras 3 linhas)</p>
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-cream">
                  {parsed.headers.map(h => <th key={h} className="px-2 py-1 text-left border border-brand-gray">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0,3).map((row, i) => (
                  <tr key={i} className="border-b border-brand-gray">
                    {row.map((cell, j) => <td key={j} className="px-2 py-1 border border-brand-gray truncate max-w-[120px]">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Voltar</button>
            <button onClick={handleImport} disabled={importing} className="btn-primary flex-1">
              {importing ? 'Importando...' : `Importar ${parsed.rows.length} contatos`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-serif text-2xl text-green mb-2">{result.imported} contatos importados!</p>
          <p className="text-charcoal/50 font-sans mb-6">Todos os contatos foram adicionados com sucesso.</p>
          <button onClick={handleClose} className="btn-primary">Fechar</button>
        </div>
      )}
    </Modal>
  );
}
