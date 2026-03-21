import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function GroupForm({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [gid, setGid] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.createGroup({ name, gid: gid ? Number(gid) : undefined }); addToast(`Group ${name} created`, 'success'); onCreated(); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create Group</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Group Name</label><input required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="form-group"><label>GID (optional)</label><input type="number" value={gid} onChange={e => setGid(e.target.value)} /></div>
          <div className="actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
