import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConvex } from 'convex/react';
import { api as convexAPI } from '../../convex/browserApi';
import { maskPhone } from '../utils/masks.js';

const STAGE_LABELS = {
  prospecting: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado_ganho: 'Ganho', cliente_ativo: 'Cliente Ativo', fechado_perdido: 'Perdido',
};
const STAGE_COLOR = {
  prospecting:    { bg: 'rgba(107,114,128,0.10)', text: '#6b7280' },
  qualificacao:   { bg: 'rgba(59,130,246,0.10)',  text: '#2563eb' },
  proposta:       { bg: 'rgba(234,179,8,0.10)',   text: '#b45309' },
  negociacao:     { bg: 'rgba(249,115,22,0.10)',  text: '#ea580c' },
  fechado_ganho:  { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a' },
  cliente_ativo:  { bg: 'rgba(53,86,65,0.12)',    text: '#355641' },
  fechado_perdido:{ bg: 'rgba(220,38,38,0.10)',   text: '#dc2626' },
};
const STAGE_COLOR_DARK = {
  prospecting:    { bg: 'rgba(107,114,128,0.18)', text: '#9ca3af' },
  qualificacao:   { bg: 'rgba(59,130,246,0.18)',  text: '#60a5fa' },
  proposta:       { bg: 'rgba(234,179,8,0.18)',   text: '#fbbf24' },
  negociacao:     { bg: 'rgba(249,115,22,0.18)',  text: '#fb923c' },
  fechado_ganho:  { bg: 'rgba(22,163,74,0.18)',   text: '#4ade80' },
  cliente_ativo:  { bg: 'rgba(53,86,65,0.25)',    text: '#86efac' },
  fechado_perdido:{ bg: 'rgba(220,38,38,0.18)',   text: '#f87171' },
};
const STAGE_ORDER = ['prospecting','qualificacao','proposta','negociacao','fechado_ganho','cliente_ativo'];

const emptyLead = { name: '', email: '', phone: '', company: '', notes: '' };

const LIGHT = {
  pageBg:      '#f5f4f2',
  navBg:       '#ffffff',
  navBorder:   '#f0eeeb',
  cardBg:      '#ffffff',
  cardBorder:  '#f0eeeb',
  modalBg:     '#ffffff',
  divider:     '#f0eeeb',
  headBg:      '#f9fafb',
  inputBg:     '#ffffff',
  inputBorder: '#e5e7eb',
  text:        '#353535',
  textMuted:   '#9ca3af',
  textSub:     '#6b7280',
};
const DARK = {
  pageBg:      '#0f1117',
  navBg:       '#1a1d27',
  navBorder:   '#2a2d3e',
  cardBg:      '#1e2130',
  cardBorder:  '#2a2d3e',
  modalBg:     '#1e2130',
  divider:     '#2a2d3e',
  headBg:      '#161825',
  inputBg:     '#161825',
  inputBorder: '#2a2d3e',
  text:        '#f0eeeb',
  textMuted:   '#6b7280',
  textSub:     '#9ca3af',
};

function StageBadge({ stage, dark }) {
  const palette = dark ? STAGE_COLOR_DARK : STAGE_COLOR;
  const s = palette[stage] || palette.prospecting;
  return (
    <span className="px-2 py-0.5 rounded-full font-sans text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

function Avatar({ name, photoUrl, size = 10 }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center font-serif font-bold text-white overflow-hidden flex-shrink-0"
      style={{ backgroundColor: '#355641', width: size * 4, height: size * 4, fontSize: size * 1.6 }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}

function RankSection({ rankData, myId }) {
  if (!rankData?.campaign) return null;
  const { campaign, rank, myPosition, myScore } = rankData;
  const fmtScore = (s) => campaign.kpiType === 'credito_producao'
    ? `R$ ${Number(s).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
    : `${s} leads`;
  const pct = campaign.kpiTarget > 0 ? Math.min(100, (myScore / campaign.kpiTarget) * 100) : 0;
  const medalEmoji = ['🥇','🥈','🥉'];

  return (
    <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #355641 0%, #4a7a5c 100%)' }}>
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-white opacity-70 mb-1">🏆 Campanha do Mês</p>
            <p className="font-serif font-bold text-2xl text-white">{campaign.prizeDescription}</p>
            {campaign.prizeValue > 0 && (
              <p className="font-sans text-sm text-white opacity-80 mt-0.5">
                Valor: R$ {Number(campaign.prizeValue).toLocaleString('pt-BR')}
              </p>
            )}
            {campaign.description && (
              <p className="font-sans text-xs text-white opacity-60 mt-1">{campaign.description}</p>
            )}
          </div>
          <div className="text-5xl flex-shrink-0">🏆</div>
        </div>

        <div className="mt-4 bg-white bg-opacity-10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans text-xs font-bold text-white opacity-80">
              {myPosition ? `Minha posição: ${myPosition}º lugar` : 'Ainda sem pontuação'}
            </span>
            <span className="font-sans text-xs font-bold text-white">{fmtScore(myScore)}</span>
          </div>
          {campaign.kpiTarget > 0 && (
            <>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#fbbf24' : '#86efac' }} />
              </div>
              <p className="font-sans text-xs text-white opacity-60 mt-1">
                {pct.toFixed(0)}% da meta ({fmtScore(campaign.kpiTarget)})
              </p>
            </>
          )}
        </div>
      </div>

      {rank.length > 0 && (
        <div className="bg-black bg-opacity-20 px-4 py-3">
          <p className="font-sans text-xs font-bold uppercase tracking-wider text-white opacity-50 mb-2">Ranking</p>
          <div className="space-y-1.5">
            {rank.slice(0, 5).map((r, i) => {
              const isMe = r.finder._id === myId;
              return (
                <div key={r.finder._id} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-all"
                  style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)' }}>
                  <span className="text-lg w-6 text-center flex-shrink-0">
                    {i < 3 ? medalEmoji[i] : <span className="font-sans text-sm font-bold text-white opacity-50">{i+1}</span>}
                  </span>
                  <Avatar name={r.finder.name} photoUrl={r.finder.photoUrl} size={7} />
                  <p className="font-sans text-sm font-semibold text-white flex-1 truncate">{r.finder.name}</p>
                  <span className="font-sans text-xs font-bold text-white opacity-80 flex-shrink-0">{fmtScore(r.score)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

export default function FinderPortal() {
  const navigate = useNavigate();
  const client = useConvex();
  const [finderId, setFinderId] = useState(null);
  const [finderData, setFinderData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('finder_dark') === '1');

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const t = dark ? DARK : LIGHT;

  function toggleDark() {
    setDark(d => {
      const next = !d;
      localStorage.setItem('finder_dark', next ? '1' : '0');
      return next;
    });
  }

  useEffect(() => {
    const token = localStorage.getItem('finder_token');
    if (!token) { navigate('/finder-login', { replace: true }); return; }
    try {
      const stored = JSON.parse(localStorage.getItem('finder_data'));
      setFinderData(stored);
      setFinderId(stored?._id ?? token);
    } catch {}
    loadData(token);
  }, []);

  async function loadData(fid) {
    const id = fid ?? finderId;
    if (!id) return;
    setLoading(true);
    try {
      const [me, leadsData] = await Promise.all([
        client.query(convexAPI.finders.get, { id }),
        client.query(convexAPI.finders.portalLeads, { finderId: id }),
      ]);
      setFinderData(me);
      localStorage.setItem('finder_data', JSON.stringify(me));
      setLeads(leadsData ?? []);

      if (me?.consultantId) {
        const month = new Date().toISOString().slice(0, 7);
        const [campaign, rankList] = await Promise.all([
          client.query(convexAPI.finders.getCampaign, { consultantId: me.consultantId, month }),
          client.query(convexAPI.finders.rank, { consultantId: me.consultantId, month }),
        ]);
        if (campaign) {
          const myEntry = rankList.find(r => r.finder._id === id);
          const myPosition = rankList.findIndex(r => r.finder._id === id) + 1 || null;
          setRankData({ campaign, rank: rankList, myPosition: myPosition || null, myScore: myEntry?.score ?? 0 });
        }
      }
    } catch (e) {
      console.error('loadData error', e);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('finder_token');
    localStorage.removeItem('finder_data');
    navigate('/finder-login', { replace: true });
  }

  async function handleAddLead(e) {
    e.preventDefault();
    if (!form.name.trim() || !finderId) return;
    setSaving(true);
    setError('');
    try {
      await client.mutation(convexAPI.contacts.create, {
        ...form,
        finderId,
        crmType: 'investimento',
        status: 'prospecting',
      });
      setSuccess('Lead indicado com sucesso!');
      setForm(emptyLead);
      setShowAdd(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao indicar lead');
    } finally { setSaving(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) { setPwError('As senhas não coincidem'); return; }
    if (pwForm.next.length < 6) { setPwError('Nova senha deve ter ao menos 6 caracteres'); return; }
    if (!finderId) return;
    setSavingPw(true);
    try {
      await client.mutation(convexAPI.finders.changePassword, {
        id: finderId,
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      setPwSuccess('Senha alterada com sucesso!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(err.message || 'Erro ao alterar senha');
    } finally { setSavingPw(false); }
  }

  function handlePhotoChange() {
    alert('Upload de foto em breve disponível.');
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const stageCount = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length;
    return acc;
  }, {});

  const inputStyle = {
    backgroundColor: t.inputBg,
    borderColor: t.inputBorder,
    color: t.text,
  };

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ backgroundColor: t.pageBg }}>
      {/* Top nav */}
      <nav className="px-6 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: t.navBg, borderColor: t.navBorder }}>
        <div className="flex items-center gap-3">
          <Avatar name={finderData?.name} photoUrl={finderData?.photoUrl} size={8} />
          <div>
            <p className="font-serif font-bold text-sm" style={{ color: t.text }}>{finderData?.name || 'Portal Finder'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
            style={{ borderColor: t.navBorder, color: t.textMuted, backgroundColor: 'transparent' }}
            title={dark ? 'Modo claro' : 'Modo escuro'}>
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={() => { setShowProfile(true); setPwError(''); setPwSuccess(''); }}
            className="font-sans text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: t.navBorder, color: t.textMuted, backgroundColor: 'transparent' }}>
            ⚙️ Perfil
          </button>
          <button onClick={logout} className="font-sans text-xs transition-colors" style={{ color: t.textMuted }}>
            Sair
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif font-bold text-2xl" style={{ color: t.text }}>Meus Leads Indicados</h1>
            <p className="font-sans text-sm mt-1" style={{ color: t.textMuted }}>Acompanhe o progresso dos seus leads no pipeline</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setSuccess(''); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90 flex-shrink-0"
            style={{ backgroundColor: '#dd7752' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Indicar Lead
          </button>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-xl font-sans text-sm flex items-center gap-2"
            style={{ backgroundColor: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}

        {/* Rank / Campaign */}
        {!loading && <RankSection rankData={rankData} myId={finderId} />}

        {/* Stage stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {STAGE_ORDER.map(stage => (
            <div key={stage} className="rounded-xl border p-3 text-center transition-colors"
              style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
              <p className="font-serif font-bold text-xl" style={{ color: t.text }}>{stageCount[stage] || 0}</p>
              <p className="font-sans text-xs mt-0.5" style={{ color: t.textMuted }}>{STAGE_LABELS[stage]}</p>
            </div>
          ))}
        </div>

        {/* Leads table */}
        <div className="rounded-2xl border shadow-sm overflow-hidden transition-colors"
          style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder }}>
          {loading ? (
            <div className="p-10 text-center">
              <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: `${t.cardBorder}`, borderTopColor: '#355641' }} />
              <p className="font-sans text-sm" style={{ color: t.textMuted }}>Carregando leads...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-5xl mb-4">🤝</div>
              <p className="font-serif font-bold text-lg" style={{ color: t.text }}>Nenhum lead indicado ainda</p>
              <p className="font-sans text-sm mt-1" style={{ color: t.textMuted }}>Clique em "Indicar Lead" para começar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead style={{ backgroundColor: t.headBg, borderBottom: `1px solid ${t.cardBorder}` }}>
                <tr>
                  {['Nome', 'Empresa', 'Telefone', 'Estágio', 'Valor', 'Data'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide"
                      style={{ color: t.textSub }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead._id} className="border-t" style={{ borderColor: t.cardBorder }}>
                    <td className="px-5 py-3">
                      <p className="font-sans font-semibold text-sm" style={{ color: t.text }}>{lead.name}</p>
                      {lead.email && <p className="font-sans text-xs" style={{ color: t.textMuted }}>{lead.email}</p>}
                    </td>
                    <td className="px-5 py-3 font-sans text-sm" style={{ color: t.textSub }}>{lead.company || '—'}</td>
                    <td className="px-5 py-3 font-sans text-sm" style={{ color: t.textSub }}>{lead.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <StageBadge stage={lead.stage || lead.status || 'prospecting'} dark={dark} />
                    </td>
                    <td className="px-5 py-3 font-sans text-sm font-semibold" style={{ color: t.text }}>
                      {['fechado_ganho', 'cliente_ativo'].includes(lead.stage) && Number(lead.value) > 0
                        ? Number(lead.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                        : <span style={{ color: t.textMuted }}>—</span>}
                    </td>
                    <td className="px-5 py-3 font-sans text-xs" style={{ color: t.textMuted }}>
                      {new Date(lead._creationTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-center font-sans text-xs mt-4" style={{ color: t.textMuted }}>
          Você visualiza os leads que indicou · O consultor gerencia o pipeline
        </p>
      </div>

      {/* Modal indicar lead */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors"
            style={{ backgroundColor: t.modalBg, border: `1px solid ${t.cardBorder}` }}>
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: t.divider }}>
              <h3 className="font-serif font-bold text-lg" style={{ color: t.text }}>Indicar Novo Lead</h3>
              <button onClick={() => setShowAdd(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: t.textMuted }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              {[
                { label: 'Nome *', key: 'name', type: 'text', placeholder: 'Nome completo' },
                { label: 'Telefone', key: 'phone', type: 'tel', placeholder: '(11) 99999-9999' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'email@exemplo.com' },
                { label: 'Empresa', key: 'company', type: 'text', placeholder: 'Empresa do lead' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block font-sans text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: t.textMuted }}>{label}</label>
                  <input type={type} value={form[key] || ''}
                    onChange={e => f(key, key === 'phone' ? maskPhone(e.target.value) : e.target.value)}
                    placeholder={placeholder} required={key === 'name'}
                    className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#dd7752'; e.target.style.boxShadow = '0 0 0 3px rgba(221,119,82,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              ))}
              <div>
                <label className="block font-sans text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: t.textMuted }}>Observações</label>
                <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)} rows={2}
                  placeholder="Contexto, motivo da indicação..."
                  className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none resize-none"
                  style={inputStyle} />
              </div>
              {error && <p className="text-sm font-sans" style={{ color: '#dc2626' }}>{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-xl font-sans text-sm font-semibold border transition-all"
                  style={{ borderColor: t.cardBorder, color: t.textSub, backgroundColor: 'transparent' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#dd7752' }}>
                  {saving ? 'Indicando...' : 'Indicar Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto transition-colors"
            style={{ backgroundColor: t.modalBg, border: `1px solid ${t.cardBorder}` }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: t.divider }}>
              <h3 className="font-serif font-bold text-lg" style={{ color: t.text }}>Meu Perfil</h3>
              <button onClick={() => setShowProfile(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: t.textMuted }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Photo */}
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>Foto de perfil</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center font-serif font-bold text-xl text-white"
                    style={{ backgroundColor: '#355641' }}>
                    {finderData?.photoUrl
                      ? <img src={finderData.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (finderData?.name || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <button type="button" onClick={handlePhotoChange}
                      className="px-4 py-2 rounded-xl font-sans text-sm font-semibold border transition-all"
                      style={{ borderColor: t.cardBorder, color: t.textSub, backgroundColor: 'transparent' }}>
                      📷 Alterar foto
                    </button>
                    <p className="font-sans text-xs mt-1" style={{ color: t.textMuted }}>JPG, PNG até 5MB</p>
                  </div>
                </div>
              </div>

              <div className="border-t" style={{ borderColor: t.divider }} />

              {/* Password change */}
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>Alterar senha</p>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  {[
                    { label: 'Senha atual', key: 'current', placeholder: '••••••' },
                    { label: 'Nova senha', key: 'next', placeholder: 'Mínimo 6 caracteres' },
                    { label: 'Confirmar nova senha', key: 'confirm', placeholder: 'Repita a nova senha' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block font-sans text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: t.textMuted }}>{label}</label>
                      <input type="password" value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder} required
                        className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                        onBlur={e => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}
                  {pwError && <p className="text-sm font-sans" style={{ color: '#dc2626' }}>{pwError}</p>}
                  {pwSuccess && <p className="text-sm font-sans" style={{ color: '#16a34a' }}>{pwSuccess}</p>}
                  <button type="submit" disabled={savingPw}
                    className="w-full py-2 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: '#355641' }}>
                    {savingPw ? 'Salvando...' : 'Alterar Senha'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
