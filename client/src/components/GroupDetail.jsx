import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import MultiSelect from './MultiSelect.jsx';

export default function GroupDetail({ groupName, onClose, onRefresh }) {
  const [group, setGroup] = useState(null);
  const [newMembers, setNewMembers] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const addToast = useToast();

  const fetchGroup = async () => {
    try { const data = await api.getGroups({ system: true }); const g = data.groups.find(g => g.name === groupName); setGroup(g); }
    catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchGroup(); }, [groupName]);

  useEffect(() => {
    api.getUsers().then(data => {
      const names = (data.users || []).map(u => u.username).sort();
      setUserOptions(names);
    }).catch(() => {});
  }, []);

  const handleAddMembers = async () => {
    if (newMembers.length === 0) return;
    try {
      await api.addMembers(groupName, newMembers);
      addToast(`${newMembers.join(', ')} added to ${groupName}`, 'success');
      setNewMembers([]);
      fetchGroup(); onRefresh();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleRemoveMember = async (username) => {
    try { await api.removeMember(groupName, username); addToast(`${username} removed from ${groupName}`, 'success'); fetchGroup(); onRefresh(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  if (!group) return null;

  const availableUsers = userOptions.filter(u => !group.members.includes(u));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{groupName} <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>GID: {group.gid}</span></h2>
        <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', margin: '16px 0 8px' }}>Members</h3>
        {group.members.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No members</p> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {group.members.map(m => (
              <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 13 }}>
                {m} <span style={{ cursor: 'pointer', color: 'var(--accent-red)' }} onClick={() => handleRemoveMember(m)}>x</span>
              </span>
            ))}
          </div>
        )}
        <h3 style={{ fontSize: 14, color: 'var(--accent-amber)', margin: '16px 0 8px' }}>Add Members</h3>
        <MultiSelect options={availableUsers} selected={newMembers} onChange={setNewMembers} placeholder="Select users to add..." emptyText="No users available" searchable />
        <div style={{ marginTop: 8 }}>
          <button onClick={handleAddMembers} disabled={newMembers.length === 0} className="primary">Add {newMembers.length > 0 ? `${newMembers.length} Member${newMembers.length > 1 ? 's' : ''}` : 'Members'}</button>
        </div>
        <div className="actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
