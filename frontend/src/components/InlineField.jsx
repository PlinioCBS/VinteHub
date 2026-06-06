import React, { useState, useRef, useEffect } from 'react';

export default function InlineField({ value, onSave, type = 'text', prefix = '', suffix = '', className = '', placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function handleKey(e) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
  }

  function save() {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-charcoal/50">{prefix}</span>}
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={save}
          className={`border-b border-green outline-none text-sm bg-transparent text-charcoal ${className}`}
        />
        {suffix && <span className="text-sm text-charcoal/50">{suffix}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`flex items-center gap-1 group text-left ${className}`}
    >
      <span className="text-sm text-charcoal">
        {prefix}{value !== null && value !== undefined && value !== '' ? value : <span className="text-charcoal/30">{placeholder}</span>}{suffix}
      </span>
      <svg className="w-3 h-3 text-charcoal/30 group-hover:text-copper opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );
}
