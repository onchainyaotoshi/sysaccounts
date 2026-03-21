import { Router } from 'express';
import { getActiveSessions, getLastLogins } from '../services/sessionService.js';

const router = Router();

router.get('/', async (req, res) => {
  try { const sessions = await getActiveSessions(); res.json({ sessions }); }
  catch (err) { res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

router.get('/logins', async (req, res) => {
  try { const limit = Number(req.query.limit) || 50; const logins = await getLastLogins(limit); res.json({ logins }); }
  catch (err) { res.status(500).json({ error: 'COMMAND_FAILED', message: err.message }); }
});

export default router;
