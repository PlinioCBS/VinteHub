import React, { useState, useMemo } from 'react';
import { BRAZIL_STATES, STATE_NAME, projectLonLat } from '../utils/brazilStates.js';
import { STATE_PATHS } from '../utils/brazilStatePaths.js';

const W = 620;
const H = 660;
const STATE_BY_UF = Object.fromEntries(BRAZIL_STATES.map(s => [s.uf, s]));

function Avatar({ person, size = 34, color = '#355641' }) {
  const initials = (person?.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return person?.photo_url ? (
    <img src={person.photo_url} alt={person.name} className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center font-serif font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

// Mapa do Brasil (com divisões por estado) marcando onde cada pessoa está localizada.
// people: [{ id, name, state, photo_url, subtitle }]
export default function TeamLocationMap({
  people = [],
  loading = false,
  markerColor = '#dc2626',
  avatarColor = '#355641',
  countColor = '#355641',
  legendLabel = 'Localizado',
}) {
  const [hoveredUf, setHoveredUf] = useState(null);

  const { byState, located, unlocated } = useMemo(() => {
    const map = {};
    const located = [];
    const unlocated = [];
    for (const p of people) {
      if (p.state && STATE_BY_UF[p.state]) {
        (map[p.state] ||= []).push(p);
        located.push(p);
      } else {
        unlocated.push(p);
      }
    }
    return { byState: map, located, unlocated };
  }, [people]);

  const statesWithTeam = Object.keys(byState);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* ── Mapa ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider">Brasil</span>
          <span className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: markerColor }} />
            {legendLabel}
          </span>
        </div>

        {loading ? (
          <div className="h-[500px] rounded-xl bg-gray-50 animate-pulse" />
        ) : (
          <div className="relative w-full" style={{ maxWidth: 620, margin: '0 auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
              {/* Estados do Brasil (com divisões) */}
              {BRAZIL_STATES.map(s => {
                const d = STATE_PATHS[s.uf];
                if (!d) return null;
                const hasTeam = !!byState[s.uf];
                const active = hoveredUf === s.uf;
                const fill = active ? `${markerColor}29`
                  : hasTeam ? `${markerColor}12`
                  : '#f4f4f2';
                return (
                  <path key={s.uf} d={d} fill={fill}
                    stroke={active ? markerColor : '#b9bfc7'}
                    strokeWidth={active ? 1.1 : 0.6}
                    strokeLinejoin="round"
                    style={{ cursor: hasTeam ? 'pointer' : 'default', transition: 'fill .15s' }}
                    onMouseEnter={() => hasTeam && setHoveredUf(s.uf)}
                    onMouseLeave={() => setHoveredUf(null)}
                  />
                );
              })}

              {/* Marcadores */}
              {statesWithTeam.map(uf => {
                const st = STATE_BY_UF[uf];
                const [x, y] = projectLonLat(st.lon, st.lat, W, H);
                const team = byState[uf];
                const active = hoveredUf === uf;
                return (
                  <g key={uf} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredUf(uf)} onMouseLeave={() => setHoveredUf(null)}>
                    <circle cx={x} cy={y} r={active ? 16 : 12} fill={markerColor} opacity={active ? 0.22 : 0.14}>
                      <animate attributeName="r" values="9;15;9" dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.22;0.05;0.22" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={x} cy={y} r={active ? 8 : 6.5} fill={markerColor} stroke="#fff" strokeWidth={2} />
                    {team.length > 1 && (
                      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle"
                        fontSize="8.5" fontWeight="700" fill="#fff">{team.length}</text>
                    )}
                    <text x={x + 11} y={y + 3.5} fontSize="11" fontWeight="700" fill="#374151"
                      style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>
                      {uf}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip */}
            {hoveredUf && (() => {
              const st = STATE_BY_UF[hoveredUf];
              const [x, y] = projectLonLat(st.lon, st.lat, W, H);
              const team = byState[hoveredUf];
              if (!team) return null;
              return (
                <div className="absolute pointer-events-none z-10 rounded-xl shadow-lg border border-gray-100 bg-white px-3 py-2"
                  style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: 'translate(-50%, -115%)', minWidth: 150 }}>
                  <p className="font-sans text-xs font-bold text-gray-800 mb-1">{st.name} ({hoveredUf})</p>
                  <div className="space-y-1">
                    {team.map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Avatar person={p} size={20} color={avatarColor} />
                        <span className="font-sans text-xs text-gray-600 whitespace-nowrap">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif font-bold text-base text-gray-900">Por Estado</h2>
            <span className="font-sans text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${countColor}14`, color: countColor }}>
              {located.length}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : statesWithTeam.length === 0 ? (
            <p className="font-sans text-sm text-gray-400 text-center py-6">Ninguém com estado definido ainda.</p>
          ) : (
            <div className="space-y-3">
              {statesWithTeam
                .sort((a, b) => STATE_NAME[a].localeCompare(STATE_NAME[b]))
                .map(uf => (
                  <div key={uf}
                    className="rounded-xl border p-2.5 transition-all"
                    style={{ borderColor: hoveredUf === uf ? `${markerColor}40` : '#f0f0f0', backgroundColor: hoveredUf === uf ? `${markerColor}0a` : 'transparent' }}
                    onMouseEnter={() => setHoveredUf(uf)} onMouseLeave={() => setHoveredUf(null)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: markerColor }} />
                      <p className="font-sans text-xs font-bold text-gray-700">{STATE_NAME[uf]} <span className="text-gray-400">({uf})</span></p>
                    </div>
                    <div className="space-y-1.5 pl-4">
                      {byState[uf].map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Avatar person={p} size={26} color={avatarColor} />
                          <div className="min-w-0">
                            <p className="font-sans text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            {p.subtitle && <p className="font-sans text-[10px] text-gray-400">{p.subtitle}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {!loading && unlocated.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-serif font-bold text-sm text-gray-700 mb-1">Sem localização</h2>
            <p className="font-sans text-xs text-gray-400 mb-3">Defina o estado no cadastro para exibir no mapa</p>
            <div className="space-y-1.5">
              {unlocated.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <Avatar person={p} size={24} color={avatarColor} />
                  <span className="font-sans text-xs text-gray-600 truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
