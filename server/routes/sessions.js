import { Router } from 'express';
import { getActiveSessions, getLastLogins, killSession } from '../services/sessionService.js';
import { validateTerminal } from '../validator.js';

const router = Router();

router.get('/', async (req, res) => {
  try { const sessions = await getActiveSessions(); res.json({ sessions }); }
  catch (err) {
    console.error('Get active sessions failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.get('/logins', async (req, res) => {
  try { const limit = Math.min(Number(req.query.limit) || 50, 500); const logins = await getLastLogins(limit); res.json({ logins }); }
  catch (err) {
    console.error('Get last logins failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

router.delete('/:terminal(*)', async (req, res) => {
  const terminal = req.params.terminal;
  if (!validateTerminal(terminal)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid terminal name' });
  }
  try {
    await killSession(terminal);
    res.json({ message: `Session on ${terminal} terminated` });
  } catch (err) {
    console.error('Kill session failed:', err.message);
    res.status(500).json({ error: 'COMMAND_FAILED', message: 'Command failed' });
  }
});

export default router;
