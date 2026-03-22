import { Router } from 'express';
import { validateUsername } from '../validator.js';
import { auditLog } from '../logger.js';
import { listSudoers, grantSudo, modifySudo, revokeSudo } from '../services/sudoService.js';

const router = Router();

router.get('/', async (req, res) => { try { const rules = await listSudoers(); res.json({ rules }); } catch (err) { res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); } });

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
    const code = err.message.includes('syntax') ? 'SUDOERS_SYNTAX' : 'COMMAND_FAILED';
    res.status(code === 'SUDOERS_SYNTAX' ? 400 : 500).json({ error: code, message: err.message });
  }
});

router.patch('/:username', async (req, res) => {
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  const { rule } = req.body;
  if (!rule) return res.status(400).json({ error: 'INVALID_INPUT', message: 'rule is required' });
  try { await modifySudo(req.params.username, rule); auditLog('MODIFY_SUDO', req.params.username, req.ip, true); res.json({ message: `Sudo rule updated for ${req.params.username}` }); }
  catch (err) { auditLog('MODIFY_SUDO', req.params.username, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.delete('/:username', async (req, res) => {
  if (!validateUsername(req.params.username)) return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Invalid username format' });
  try { await revokeSudo(req.params.username); auditLog('REVOKE_SUDO', req.params.username, req.ip, true); res.json({ message: `Sudo revoked for ${req.params.username}` }); }
  catch (err) { auditLog('REVOKE_SUDO', req.params.username, req.ip, false, err.message); res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

export default router;
