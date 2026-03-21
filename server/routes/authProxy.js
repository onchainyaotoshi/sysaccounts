import { Router } from 'express';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL;
const router = Router();

async function proxyRequest(accountsPath, req, res) {
  try {
    const headers = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const options = { method: req.method, headers };
    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${ACCOUNTS_URL}${accountsPath}`, options);
    const body = await response.text();

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(response.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'AUTH_UNAVAILABLE', message: 'Authentication service unavailable' });
  }
}

router.post('/token', (req, res) => proxyRequest('/token', req, res));
router.get('/me', (req, res) => proxyRequest('/me', req, res));
router.post('/logout', (req, res) => proxyRequest('/logout', req, res));

export default router;
