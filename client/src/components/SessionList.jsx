import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [logins, setLogins] = useState([]);
  const addToast = useToast();

  const fetchData = async () => {
    try { const [s, l] = await Promise.all([api.getSessions(), api.getLogins(50)]); setSessions(s.sessions); setLogins(l.logins); }
    catch (err) { addToast(err.message, 'error'); }
  };
  useEffect(() => { fetchData(); }, []);

  return (
    <div>
      <h1 style={{ fontSize: 18, color: 'var(--accent-green)', marginBottom: 16 }}>Sessions</h1>
      <h2 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Active Sessions</h2>
      <table>
        <thead><tr><th>User</th><th>Terminal</th><th>Date</th><th>Host</th></tr></thead>
        <tbody>
          {sessions.map((s, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--accent-green)' }}>{s.user}</td>
              <td>{s.terminal}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{s.date}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{s.host || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No active sessions</p>}

      <h2 style={{ fontSize: 14, color: 'var(--accent-amber)', margin: '24px 0 8px' }}>Recent Logins</h2>
      <table>
        <thead><tr><th>User</th><th>Terminal</th><th>Host</th><th>Duration</th></tr></thead>
        <tbody>
          {logins.map((l, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--accent-green)' }}>{l.user}</td>
              <td>{l.terminal}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{l.host || '-'}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{l.duration || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logins.length === 0 && <p style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No login history</p>}
      <button onClick={fetchData} style={{ marginTop: 16 }}>Refresh</button>
    </div>
  );
}
