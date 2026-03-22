import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import GroupDetail from './GroupDetail.jsx';
import GroupForm from './GroupForm.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function GroupTable({ socketOn }) {
  const [groups, setGroups] = useState([]);
  const [showSystem, setShowSystem] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const addToast = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchGroups = async () => {
    try { const data = await api.getGroups({ system: showSystem, search: debouncedSearch }); setGroups(data.groups); }
    catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchGroups(); }, [showSystem, debouncedSearch]);
  useEffect(() => { return socketOn('groups:changed', () => { fetchGroups(); }); }, [socketOn, showSystem, debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.deleteGroup(deleteTarget); addToast(`Group ${deleteTarget} deleted`, 'success'); setDeleteTarget(null); fetchGroups(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: 'var(--accent-green)' }}>Groups</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} /> System groups
          </label>
          <button className="primary" onClick={() => setShowForm(true)}>+ Add Group</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>GID</th><th>Members</th><th>Actions</th></tr></thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.name} style={{ cursor: 'pointer' }} onClick={() => setSelected(g.name)}>
              <td style={{ color: 'var(--accent-green)' }}>
                {g.name}
              </td>
              <td>{g.gid}</td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {g.members.length} members
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-amber, #f39c12)', opacity: 0.8 }}>click to manage</span>
              </td>
              <td><button className="danger" style={{ padding: '2px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setDeleteTarget(g.name); }}>delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && <GroupDetail groupName={selected} onClose={() => setSelected(null)} onRefresh={fetchGroups} />}
      {showForm && <GroupForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchGroups(); }} />}
      {deleteTarget && <ConfirmDialog title="Delete Group" message={`Delete group "${deleteTarget}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
