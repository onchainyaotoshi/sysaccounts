import { NavLink } from 'react-router-dom';
import { getAuth } from '../auth.js';
import StatusBar from './StatusBar.jsx';

const navItems = [
  { path: '/users', label: 'Users' },
  { path: '/groups', label: 'Groups' },
  { path: '/sudo', label: 'Sudo' },
  { path: '/sessions', label: 'Sessions' },
];

export default function Layout({ children, connected, hostname }) {
  const handleLogout = () => {
    const auth = getAuth();
    auth.logout();
  };

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-green)', fontSize: 18 }}>|</span>
          <span style={{ fontWeight: 'bold' }}>Server User Management</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>server: {hostname || '...'}</span>
          <button onClick={handleLogout} style={{ padding: '4px 12px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav style={{ width: 180, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '12px 0' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path}
              style={({ isActive }) => ({ display: 'block', padding: '8px 20px', color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)', textDecoration: 'none', borderLeft: isActive ? '3px solid var(--accent-green)' : '3px solid transparent', background: isActive ? 'var(--bg-hover)' : 'transparent', fontSize: 14 })}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</main>
      </div>
      <StatusBar connected={connected} />
    </>
  );
}
