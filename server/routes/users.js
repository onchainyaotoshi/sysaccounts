import { Router } from 'express';
import { validateUsername, validateShell, validateRequired, validateHome, validateGecos, validateInteger, validatePassword } from '../validator.js';
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
    console.error('List users failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.get('/:username', async (req, res) => {
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try {
    const user = await getUserDetail(req.params.username);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User does not exist' });
    res.json(user);
  } catch (err) {
    console.error('Get user detail failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/', async (req, res) => {
  const { username, password, shell, home, gecos, groups, createHome } = req.body;
  if (!username) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Missing required fields: username' });
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });
  if (home && !validateHome(home)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid home directory path' });
  if (gecos && !validateGecos(gecos)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid GECOS field' });
  if (password && !validatePassword(password)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid password: must be 8-1024 characters, no newlines or colons' });
  try {
    await createUser({ username, password, shell, home, gecos, groups, createHome });
    auditLog('CREATE_USER', username, req.ip, true);
    res.status(201).json({ message: `User ${username} created` });
  } catch (err) {
    auditLog('CREATE_USER', username, req.ip, false, err.message);
    if (err.message.includes('already exists')) {
      res.status(409).json({ error: 'USER_EXISTS', message: err.message });
    } else {
      console.error('Create user failed:', err.message);
      res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
    }
  }
});

router.delete('/:username', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const removeHome = req.query.removeHome === 'true';
  try {
    await deleteUser(username, removeHome);
    auditLog('DELETE_USER', username, req.ip, true);
    res.json({ message: `User ${username} deleted` });
  } catch (err) {
    auditLog('DELETE_USER', username, req.ip, false, err.message);
    console.error('Delete user failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.patch('/:username', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { shell, home, gecos } = req.body;
  if (shell && !validateShell(shell)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid shell path' });
  if (home && !validateHome(home)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid home directory path' });
  if (gecos && !validateGecos(gecos)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid GECOS field' });
  try {
    await modifyUser(username, { shell, home, gecos });
    auditLog('MODIFY_USER', username, req.ip, true);
    res.json({ message: `User ${username} modified` });
  } catch (err) {
    auditLog('MODIFY_USER', username, req.ip, false, err.message);
    console.error('Modify user failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/:username/password', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { password } = req.body;
  if (!password || !validatePassword(password)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid password: must be 8-1024 characters, no newlines or colons' });
  try {
    await changePassword(username, password);
    auditLog('CHANGE_PASSWORD', username, req.ip, true);
    res.json({ message: 'Password changed' });
  } catch (err) {
    auditLog('CHANGE_PASSWORD', username, req.ip, false, err.message);
    console.error('Change password failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/:username/lock', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { locked } = req.body;
  if (typeof locked !== 'boolean') return res.status(400).json({ error: 'INVALID_INPUT', message: 'locked must be boolean' });
  try {
    await lockUser(username, locked);
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, true);
    res.json({ message: `User ${username} ${locked ? 'locked' : 'unlocked'}` });
  } catch (err) {
    auditLog(locked ? 'LOCK_USER' : 'UNLOCK_USER', username, req.ip, false, err.message);
    console.error('Lock/unlock user failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.patch('/:username/aging', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { minDays, maxDays, warnDays, inactiveDays, expireDate } = req.body;
  if (minDays !== undefined && !validateInteger(minDays)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'minDays must be an integer' });
  if (maxDays !== undefined && !validateInteger(maxDays)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'maxDays must be an integer' });
  if (warnDays !== undefined && !validateInteger(warnDays)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'warnDays must be an integer' });
  if (inactiveDays !== undefined && !validateInteger(inactiveDays)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'inactiveDays must be an integer' });
  if (expireDate !== undefined && expireDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'expireDate must be in YYYY-MM-DD format' });
  try {
    await changeAging(username, req.body);
    auditLog('CHANGE_AGING', username, req.ip, true);
    res.json({ message: 'Password aging updated' });
  } catch (err) {
    auditLog('CHANGE_AGING', username, req.ip, false, err.message);
    console.error('Change aging failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

export default router;
