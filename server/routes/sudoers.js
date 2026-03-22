import { Router } from 'express';
import { validateUsername } from '../validator.js';
import { auditLog } from '../logger.js';
import { listSudoers, grantSudo, modifySudo, revokeSudo } from '../services/sudoService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rules = await listSudoers();
    res.json({ rules });
  } catch (err) {
    console.error('List sudoers failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.post('/', async (req, res) => {
  const { username, rule } = req.body;
  if (!username || !rule) return res.status(400).json({ error: 'INVALID_INPUT', message: 'username and rule are required' });
  if (!validateUsername(username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try {
    await grantSudo(username, rule);
    auditLog('GRANT_SUDO', username, req.ip, true);
    res.status(201).json({ message: `Sudo granted to ${username}` });
  } catch (err) {
    auditLog('GRANT_SUDO', username, req.ip, false, err.message);
    const isSyntaxError = err.message.includes('syntax') || err.message.includes('Invalid sudo rule');
    if (isSyntaxError) {
      res.status(400).json({ error: 'SUDOERS_SYNTAX', message: err.message });
    } else {
      console.error('Grant sudo failed:', err.message);
      res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
    }
  }
});

router.patch('/:username', async (req, res) => {
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { rule } = req.body;
  if (!rule) return res.status(400).json({ error: 'INVALID_INPUT', message: 'rule is required' });
  try {
    await modifySudo(req.params.username, rule);
    auditLog('MODIFY_SUDO', req.params.username, req.ip, true);
    res.json({ message: `Sudo rule updated for ${req.params.username}` });
  } catch (err) {
    auditLog('MODIFY_SUDO', req.params.username, req.ip, false, err.message);
    console.error('Modify sudo failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.delete('/:username', async (req, res) => {
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try {
    await revokeSudo(req.params.username);
    auditLog('REVOKE_SUDO', req.params.username, req.ip, true);
    res.json({ message: `Sudo revoked for ${req.params.username}` });
  } catch (err) {
    auditLog('REVOKE_SUDO', req.params.username, req.ip, false, err.message);
    console.error('Revoke sudo failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

export default router;
