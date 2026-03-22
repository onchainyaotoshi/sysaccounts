import { Router } from 'express';
import { validateGroupname, validateUsername } from '../validator.js';
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
  } catch (err) { res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.post('/', async (req, res) => {
  const { name, gid } = req.body;
  if (!name) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Group name is required' });
  if (!validateGroupname(name)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid group name format' });
  try {
    await createGroup(name, gid);
    auditLog('CREATE_GROUP', name, req.ip, true);
    res.status(201).json({ message: `Group ${name} created` });
  } catch (err) { auditLog('CREATE_GROUP', name, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.delete('/:groupname', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  try {
    await deleteGroup(req.params.groupname);
    auditLog('DELETE_GROUP', req.params.groupname, req.ip, true);
    res.json({ message: `Group ${req.params.groupname} deleted` });
  } catch (err) { auditLog('DELETE_GROUP', req.params.groupname, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.patch('/:groupname', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  const { newName, gid } = req.body;
  if (newName && !validateGroupname(newName)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid new group name format' });
  if (gid !== undefined && (!Number.isInteger(Number(gid)) || Number(gid) < 0)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'gid must be a positive integer' });
  try {
    await modifyGroup(req.params.groupname, { newName, gid });
    auditLog('MODIFY_GROUP', req.params.groupname, req.ip, true);
    res.json({ message: `Group ${req.params.groupname} modified` });
  } catch (err) { auditLog('MODIFY_GROUP', req.params.groupname, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
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
    auditLog('ADD_MEMBERS', `${req.params.groupname}: ${usernames.join(',')}`, req.ip, true);
    res.json({ message: `Members added to ${req.params.groupname}` });
  } catch (err) { auditLog('ADD_MEMBERS', req.params.groupname, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.delete('/:groupname/members/:username', async (req, res) => {
  if (!validateGroupname(req.params.groupname)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid group name format' });
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try {
    await removeMember(req.params.groupname, req.params.username);
    auditLog('REMOVE_MEMBER', `${req.params.groupname}: ${req.params.username}`, req.ip, true);
    res.json({ message: `${req.params.username} removed from ${req.params.groupname}` });
  } catch (err) { auditLog('REMOVE_MEMBER', req.params.groupname, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

export default router;
