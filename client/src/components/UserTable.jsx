import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import UserDetail from './UserDetail.jsx';
import UserForm from './UserForm.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function UserTable({ socketOn }) {
  const [users, setUsers] = useState([]);
  const [showSystem, setShowSystem] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const addToast = useToast();

  const fetchUsers = async () => {
    try { const data = await api.getUsers({ system: showSystem, search, limit: 500 }); setUsers(data.users); }
    catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchUsers(); }, [showSystem, search]);
  useEffect(() => { return socketOn('users:changed', (payload) => { setUsers(payload.data.filter(u => showSystem || u.uid >= 1000 || u.uid === 0)); }); }, [socketOn, showSystem]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.deleteUser(deleteTarget, false); addToast(`User ${deleteTarget} deleted`, 'success'); setDeleteTarget(null); fetchUsers(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Users</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} /> System users
          </label>
          <button className="primary" onClick={() => setShowForm(true)}>+ Add User</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Username</th><th>UID</th><th>Home</th><th>Shell</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username} style={{ cursor: 'pointer' }} onClick={() => setSelected(u.username)}>
              <td style={{ color: 'var(--accent-green)' }}>{u.username}</td>
              <td>{u.uid}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{u.home}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{u.shell}</td>
              <td><span className={`badge ${u.locked ? 'red' : 'green'}`}>{u.locked ? 'locked' : 'active'}</span></td>
              <td><button className="danger" style={{ padding: '2px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setDeleteTarget(u.username); }}>delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</p>}
      {selected && <UserDetail username={selected} onClose={() => setSelected(null)} onRefresh={fetchUsers} />}
      {showForm && <UserForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchUsers(); }} />}
      {deleteTarget && <ConfirmDialog title="Delete User" message={`Are you sure you want to delete user "${deleteTarget}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
