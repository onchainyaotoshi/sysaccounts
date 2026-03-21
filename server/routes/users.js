import { Router } from 'express';
import { validateUsername, validateShell, validateRequired } from '../validator.js';
import { auditLog } from '../logger.js';
import {
  listUsers, getUserDetail, createUser, deleteUser,
  modifyUser, lockUser, changePassword, changeAging,
} from '../services/userService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let users = await listUsers();
    const { system, search, limit = 50, offset = 0 } = req.query;
    if (system !== 'true') {
      users = users.filter(u => u.uid >= 1000 || u.uid === 0);
    }
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.username.includes(q) || u.gecos.toLowerCase().includes(q));
    }
    const total = users.length;
    users = users.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const user = await getUserDetail(req.params.username);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User does not exist' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { username, password, shell, home, gecos, groups, createHome } = req.body;
  if (!username) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Missing required fields: username' });
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });
  try {
    await createUser({ username, password, shell, home, gecos, groups, createHome });
    auditLog('CREATE_USER', username, req.ip, true);
    res.status(201).json({ message: `User ${username} created` });
  } catch (err) {
    auditLog('CREATE_USER', username, req.ip, false, err.message);
    const status = err.message.includes('already exists') ? 409 : 500;
    const code = status === 409 ? 'USER_EXISTS' : 'COMMAND_FAILED';
    res.status(status).json({ error: code, message: err.message });
  }
});

router.delete('/:username', async (req, res) => {
  const { username } = req.params;
  const removeHome = req.query.removeHome === 'true';
  try {
    await deleteUser(username, removeHome);
    auditLog('DELETE_USER', username, req.ip, true);
    res.json({ message: `User ${username} deleted` });
  } catch (err) {
    auditLog('DELETE_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.patch('/:username', async (req, res) => {
  const { username } = req.params;
  const { shell, home, gecos } = req.body;
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });
  try {
    await modifyUser(username, { shell, home, gecos });
    auditLog('MODIFY_USER', username, req.ip, true);
    res.json({ message: `User ${username} modified` });
  } catch (err) {
    auditLog('MODIFY_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/:username/password', async (req, res) => {
  const { username } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Password is required' });
  try {
    await changePassword(username, password);
    auditLog('CHANGE_PASSWORD', username, req.ip, true);
    res.json({ message: 'Password changed' });
  } catch (err) {
    auditLog('CHANGE_PASSWORD', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.post('/:username/lock', async (req, res) => {
  const { username } = req.params;
  const { locked } = req.body;
  if (typeof locked !== 'boolean') return res.status(400).json({ error: 'INVALID_INPUT', message: 'locked must be boolean' });
  try {
    await lockUser(username, locked);
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, true);
    res.json({ message: `User ${username} ${locked ? 'locked' : 'unlocked'}` });
  } catch (err) {
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

router.patch('/:username/aging', async (req, res) => {
  const { username } = req.params;
  try {
    await changeAging(username, req.body);
    auditLog('CHANGE_AGING', username, req.ip, true);
    res.json({ message: 'Password aging updated' });
  } catch (err) {
    auditLog('CHANGE_AGING', username, req.ip, false, err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: err.message });
  }
});

export default router;
