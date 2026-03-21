import { useState, useEffect, useRef } from 'react';

export default function MultiSelect({ options, selected, onChange, placeholder = 'Select...', emptyText = 'No options', searchable = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = options.filter(o => !selected.includes(o));
  const filtered = search ? available.filter(o => o.toLowerCase().includes(search.toLowerCase())) : available;

  const toggle = (name) => {
    onChange(selected.includes(name) ? selected.filter(g => g !== name) : [...selected, name]);
    setSearch('');
  };

  const remove = (name) => onChange(selected.filter(g => g !== name));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          border: '1px solid var(--border-color, #444)', borderRadius: 4, padding: '6px 8px',
          minHeight: 34, cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 4,
          background: 'var(--input-bg, #1a1a2e)', alignItems: 'center'
        }}
      >
        {selected.length === 0 && !open && <span style={{ color: 'var(--text-muted, #666)' }}>{placeholder}</span>}
        {selected.map(g => (
          <span key={g} style={{
            background: 'var(--accent-green, #2ecc71)', color: '#000', borderRadius: 3,
            padding: '1px 6px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            {g}
            <span onClick={(e) => { e.stopPropagation(); remove(g); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>&times;</span>
          </span>
        ))}
        {searchable && open && (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Search..."
            style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', flex: 1, minWidth: 80, fontSize: 13 }}
          />
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: 'var(--card-bg, #16213e)', border: '1px solid var(--border-color, #444)',
          borderRadius: 4, marginTop: 2, maxHeight: 180, overflowY: 'auto'
        }}>
          {filtered.length === 0 && <div style={{ padding: '8px 12px', color: 'var(--text-muted, #666)' }}>{emptyText}</div>}
          {filtered.map(g => (
            <div
              key={g}
              onClick={() => toggle(g)}
              style={{
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: selected.includes(g) ? 'rgba(46,204,113,0.15)' : 'transparent'
              }}
              onMouseEnter={e => e.currentTarget.style.background = selected.includes(g) ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = selected.includes(g) ? 'rgba(46,204,113,0.15)' : 'transparent'}
            >
              <span style={{ width: 16, textAlign: 'center', color: 'var(--accent-green, #2ecc71)' }}>{selected.includes(g) ? '\u2713' : ''}</span>
              <span>{g}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
