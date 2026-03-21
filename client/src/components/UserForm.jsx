import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function UserForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', password: '', shell: '/bin/bash', home: '', gecos: '', groups: '', createHome: true });
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.createUser({ ...form, home: form.home || `/home/${form.username}`, groups: form.groups ? form.groups.split(',').map(g => g.trim()) : [] });
      addToast(`User ${form.username} created`, 'success'); onCreated();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create User</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Username</label><input required value={form.username} onChange={update('username')} placeholder="jdoe" /></div>
          <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={update('password')} /></div>
          <div className="form-group"><label>Full Name (GECOS)</label><input value={form.gecos} onChange={update('gecos')} placeholder="John Doe" /></div>
          <div className="form-group"><label>Shell</label><input value={form.shell} onChange={update('shell')} /></div>
          <div className="form-group"><label>Home Directory</label><input value={form.home} onChange={update('home')} placeholder={`/home/${form.username || 'username'}`} /></div>
          <div className="form-group"><label>Groups (comma-separated)</label><input value={form.groups} onChange={update('groups')} placeholder="developers, docker" /></div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.createHome} onChange={update('createHome')} />
            <label style={{ margin: 0 }}>Create home directory</label>
          </div>
          <div className="actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
