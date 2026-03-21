import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function SudoersList() {
  const [rules, setRules] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ username: '', rule: 'ALL=(ALL) ALL' });
  const addToast = useToast();

  const fetchRules = async () => { try { const data = await api.getSudoers(); setRules(data.rules); } catch (err) { addToast(err.message, 'error'); } };
  useEffect(() => { fetchRules(); }, []);

  const handleGrant = async (e) => {
    e.preventDefault();
    try { await api.grantSudo(form); addToast(`Sudo granted to ${form.username}`, 'success'); setShowGrant(false); setForm({ username: '', rule: 'ALL=(ALL) ALL' }); fetchRules(); }
    catch (err) { addToast(err.message, 'error'); }
  };
  const handleRevoke = async (username) => {
    try { await api.revokeSudo(username); addToast(`Sudo revoked for ${username}`, 'success'); fetchRules(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Sudo Rules</h1>
        <button className="primary" onClick={() => setShowGrant(true)}>+ Grant Sudo</button>
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
              <div className="form-group"><label>Username</label><input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
              <div className="form-group"><label>Rule</label><input required value={form.rule} onChange={e => setForm({ ...form, rule: e.target.value })} /></div>
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
