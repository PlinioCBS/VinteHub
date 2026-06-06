import React, { useState, useRef, useEffect } from 'react';
import { useCRM, CRM_CONFIG } from '../contexts/CRMContext.jsx';

export default function CRMSelector() {
  const { activeCRM, setActiveCRM, currentCRM } = useCRM();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 hover:shadow-md"
        style={{
          backgroundColor: currentCRM.bgLight,
          borderColor: currentCRM.color + '40',
          color: currentCRM.color
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: currentCRM.color }}
        />
        <span className="font-sans font-semibold text-sm">{currentCRM.label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          style={{ backgroundColor: 'white' }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-sans text-gray-400 font-medium uppercase tracking-wider">Selecionar CRM</p>
          </div>
          {Object.entries(CRM_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setActiveCRM(key); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-gray-50"
              style={{
                backgroundColor: activeCRM === key ? cfg.bgLight : undefined,
              }}
            >
              <span className="text-xl">{cfg.icon}</span>
              <div className="flex-1">
                <div className="font-sans font-semibold text-sm" style={{ color: cfg.color }}>
                  {cfg.label}
                </div>
              </div>
              {activeCRM === key && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: cfg.color }}>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
