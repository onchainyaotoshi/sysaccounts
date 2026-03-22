import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

const RULE_PRESETS = [
  { label: 'Full sudo access', value: 'ALL=(ALL) ALL' },
  { label: 'Full sudo (no password)', value: 'ALL=(ALL) NOPASSWD: ALL' },
  { label: 'Package management', value: 'ALL=(ALL) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/bin/dpkg' },
  { label: 'Service management', value: 'ALL=(ALL) NOPASSWD: /usr/bin/systemctl' },
  { label: 'Docker', value: 'ALL=(ALL) NOPASSWD: /usr/bin/docker' },
  { label: 'Reboot/shutdown', value: 'ALL=(ALL) NOPASSWD: /usr/sbin/reboot, /usr/sbin/shutdown' },
  { label: 'Custom rule', value: '__custom__' },
];

export default function SudoersList() {
  const [rules, setRules] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', preset: RULE_PRESETS[0].value, customRule: '' });
  const addToast = useToast();

  const fetchRules = async () => { try { const data = await api.getSudoers(); setRules(data.rules); } catch (err) { addToast(err.message, 'error'); } };
  useEffect(() => { fetchRules(); }, []);

  const openGrant = async () => {
    try {
      const data = await api.getUsers();
      const nonSystem = data.users.filter(u => u.uid >= 1000);
      setUsers(nonSystem);
      setForm({ username: nonSystem[0]?.username || '', preset: RULE_PRESETS[0].value, customRule: '' });
      setShowGrant(true);
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    const rule = form.preset === '__custom__' ? form.customRule : form.preset;
    if (!rule) { addToast('Please enter a custom rule', 'error'); return; }
    try {
      await api.grantSudo({ username: form.username, rule });
      addToast(`Sudo granted to ${form.username}`, 'success');
      setShowGrant(false);
      fetchRules();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleRevoke = async (username) => {
    try { await api.revokeSudo(username); addToast(`Sudo revoked for ${username}`, 'success'); fetchRules(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Sudo Rules</h1>
        <button className="primary" onClick={openGrant}>+ Grant Sudo</button>
      </div>
      <table>
        <thead><tr><th>Type</th><th>Name</th><th>Rule</th><th>Actions</th></tr></thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={i}>
              <td><span className={`badge ${r.type === 'user' ? 'green' : 'amber'}`}>{r.type}</span></td>
              <td style={{ color: 'var(--accent-green)' }}>{r.username}</td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.rule}</td>
              <td>{r.type === 'user' && <button className="danger" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => handleRevoke(r.username)}>revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rules.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No sudo rules found</p>}
      {showGrant && (
        <div className="modal-overlay" onClick={() => setShowGrant(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Grant Sudo</h2>
            <form onSubmit={handleGrant}>
              <div className="form-group">
                <label>Username</label>
                <select required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}>
                  {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Rule</label>
                <select value={form.preset} onChange={e => setForm({ ...form, preset: e.target.value, customRule: '' })}>
                  {RULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              {form.preset === '__custom__' && (
                <div className="form-group">
                  <label>Custom Rule</label>
                  <input required value={form.customRule} onChange={e => setForm({ ...form, customRule: e.target.value })} placeholder="ALL=(ALL) NOPASSWD: /path/to/command" />
                  <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Format: ALL=(ALL) NOPASSWD: /path/to/command1, /path/to/command2 &mdash;{' '}
                    <a href="https://man7.org/linux/man-pages/man5/sudoers.5.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)' }}>Learn sudoers rule format</a>
                  </small>
                </div>
              )}
              <div className="actions">
                <button type="button" onClick={() => setShowGrant(false)}>Cancel</button>
                <button type="submit" className="primary">Grant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
