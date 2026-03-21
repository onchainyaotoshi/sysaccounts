export default function StatusBar({ connected }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 12, color: 'var(--text-secondary)' }}>
      <span>$ ready</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
        {connected ? 'connected' : 'disconnected'}
      </span>
    </div>
  );
}
