import { Router } from 'express';
import { validateGroupname, validateUsername, validateInteger } from '../validator.js';
import { auditLog } from '../logger.js';
import { listGroups, createGroup, deleteGroup, modifyGroup, addMember, removeMember } from '../services/groupService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let groups = await listGroups();
    const { system, search } = req.query;
    if (system !== 'true') { groups = groups.filter(g => g.gid >= 1000 || g.gid === 0); }
    if (search) { const q = search.toLowerCase(); groups = groups.filter(g => g.name.includes(q)); }
    res.json({ groups });
  } catch (err) {
    console.error('List groups failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/', async (req, res) => {
  const { name, gid } = req.body;
  if (!name) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Group name is required' });
  if (!validateGroupname(name)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid group name format' });
  if (gid !== undefined && !validateInteger(gid, 0, 65535)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be an integer between 0 and 65535' });
  try {
    await createGroup(name, gid);
    auditLog('CREATE_GROUP', name, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
    res.status(201).json({ message: `Group ${name} created` });
  } catch (err) {
    auditLog('CREATE_GROUP', name, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
    if (err.code === 'GROUP_EXISTS') {
      res.status(409).json({ error: 'GROUP_EXISTS', message: err.message });
    } else {
      console.error('Create group failed:', err.message);
      res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
    }
  }
});

router.delete('/:groupname', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  try {
    await deleteGroup(req.params.groupname);
    auditLog('DELETE_GROUP', req.params.groupname, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
    res.json({ message: `Group ${req.params.groupname} deleted` });
  } catch (err) {
    auditLog('DELETE_GROUP', req.params.groupname, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
    console.error('Delete group failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.patch('/:groupname', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  const { newName, gid } = req.body;
  if (newName && !validateGroupname(newName)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid new group name format' });
  if (gid !== undefined && !validateInteger(gid, 0, 65535)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be an integer between 0 and 65535' });
  try {
    await modifyGroup(req.params.groupname, { newName, gid });
    auditLog('MODIFY_GROUP', req.params.groupname, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
    res.json({ message: `Group ${req.params.groupname} modified` });
  } catch (err) {
    auditLog('MODIFY_GROUP', req.params.groupname, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
    console.error('Modify group failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/:groupname/members', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  const { usernames } = req.body;
  if (!Array.isArray(usernames) || usernames.length === 0) return res.status(400).json({ error: 'INVALID_INPUT', message: 'usernames array is required' });
  for (const username of usernames) {
    if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: `Invalid username format: ${username}` });
  }
  try {
    for (const username of usernames) { await addMember(req.params.groupname, username); }
    auditLog('ADD_MEMBERS', `${req.params.groupname}: ${usernames.join(',')}`, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
    res.json({ message: `Members added to ${req.params.groupname}` });
  } catch (err) {
    auditLog('ADD_MEMBERS', req.params.groupname, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
    console.error('Add members failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.delete('/:groupname/members/:username', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try {
    await removeMember(req.params.groupname, req.params.username);
    auditLog('REMOVE_MEMBER', `${req.params.groupname}: ${req.params.username}`, req.ip, true, '', req.user?.email || req.user?.sub || 'anonymous');
    res.json({ message: `${req.params.username} removed from ${req.params.groupname}` });
  } catch (err) {
    auditLog('REMOVE_MEMBER', req.params.groupname, req.ip, false, err.message, req.user?.email || req.user?.sub || 'anonymous');
    console.error('Remove member failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

export default router;
