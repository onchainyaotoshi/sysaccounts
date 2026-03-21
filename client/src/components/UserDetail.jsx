import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function UserDetail({ username, onClose, onRefresh }) {
  const [user, setUser] = useState(null);
  const [editShell, setEditShell] = useState('');
  const [editGecos, setEditGecos] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const addToast = useToast();

  useEffect(() => {
    api.getUser(username).then(u => { setUser(u); setEditShell(u.shell); setEditGecos(u.gecos); }).catch(err => addToast(err.message, 'error'));
  }, [username]);

  if (!user) return null;

  const handleModify = async () => {
    try { await api.modifyUser(username, { shell: editShell, gecos: editGecos }); addToast('User modified', 'success'); onRefresh(); }
    catch (err) { addToast(err.message, 'error'); }
  };
  const handlePassword = async () => {
    try { await api.changePassword(username, newPassword); addToast('Password changed', 'success'); setNewPassword(''); }
    catch (err) { addToast(err.message, 'error'); }
  };
  const handleLock = async () => {
    try { await api.lockUser(username, !user.locked); addToast(`User ${user.locked ? 'unlocked' : 'locked'}`, 'success'); setUser({ ...user, locked: !user.locked }); onRefresh(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
        <h2>{username}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 20, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-secondary)' }}>UID:</span> {user.uid}</div>
          <div><span style={{ color: 'var(--text-secondary)' }}>GID:</span> {user.gid}</div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Home:</span> {user.home}</div>
          <div><span style={{ color: 'var(--text-secondary)' }}>Status:</span> <span className={`badge ${user.locked ? 'red' : 'green'}`}>{user.locked ? 'locked' : 'active'}</span></div>
          <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-secondary)' }}>Groups:</span> {(user.groups || []).map(g => <span key={g} className="badge amber" style={{ marginRight: 4 }}>{g}</span>)}</div>
          {user.sudo?.hasSudo && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-secondary)' }}>Sudo:</span> {user.sudo.rules.join(', ')}</div>}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Edit</h3>
          <div className="form-group"><label>Shell</label><input value={editShell} onChange={e => setEditShell(e.target.value)} /></div>
          <div className="form-group"><label>Full Name</label><input value={editGecos} onChange={e => setEditGecos(e.target.value)} /></div>
          <button onClick={handleModify} style={{ marginBottom: 16 }}>Save Changes</button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8 }}>Password</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ flex: 1 }} />
            <button onClick={handlePassword} disabled={!newPassword}>Change</button>
          </div>
        </div>
        <div className="actions" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <button onClick={handleLock} className={user.locked ? '' : 'danger'}>{user.locked ? 'Unlock' : 'Lock'} Account</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
