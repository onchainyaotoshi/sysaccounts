import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function GroupDetail({ groupName, onClose, onRefresh }) {
  const [group, setGroup] = useState(null);
  const [newMember, setNewMember] = useState('');
  const addToast = useToast();

  const fetchGroup = async () => {
    try { const data = await api.getGroups({ system: true }); const g = data.groups.find(g => g.name === groupName); setGroup(g); }
    catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => { fetchGroup(); }, [groupName]);

  const handleAddMember = async () => {
    if (!newMember) return;
    try { await api.addMembers(groupName, [newMember.trim()]); addToast(`${newMember} added to ${groupName}`, 'success'); setNewMember(''); fetchGroup(); onRefresh(); }
    catch (err) { addToast(err.message, 'error'); }
  };
  const handleRemoveMember = async (username) => {
    try { await api.removeMember(groupName, username); addToast(`${username} removed from ${groupName}`, 'success'); fetchGroup(); onRefresh(); }
    catch (err) { addToast(err.message, 'error'); }
  };

  if (!group) return null;

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
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input placeholder="Username" value={newMember} onChange={e => setNewMember(e.target.value)} style={{ flex: 1 }} />
          <button onClick={handleAddMember}>Add Member</button>
        </div>
        <div className="actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
