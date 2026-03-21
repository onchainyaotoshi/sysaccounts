import { createHash } from 'crypto';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL;
const CACHE_TTL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 10 * 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthMiddleware() {
  const cache = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now > entry.expiresAt) cache.delete(key);
    }
  }, CLEANUP_INTERVAL);
  cleanupTimer.unref();

  return async (req, res, next) => {
    if (req.path === '/health') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const tokenKey = hashToken(token);

    const cached = cache.get(tokenKey);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.userInfo;
      return next();
    }

    try {
      const response = await fetch(`${ACCOUNTS_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        cache.delete(tokenKey);
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
      }

      const userInfo = await response.json();
      if (!userInfo.sub || !userInfo.email) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid user info' });
      }

      cache.set(tokenKey, { userInfo, expiresAt: Date.now() + CACHE_TTL });
      req.user = userInfo;
      next();
    } catch (err) {
      return res.status(502).json({ error: 'AUTH_UNAVAILABLE', message: 'Authentication service unavailable' });
    }
  };
}
