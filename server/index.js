import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startWatcher } from './watcher.js';
import { createAuthMiddleware } from './middleware/auth.js';
import authProxyRouter from './routes/authProxy.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import sudoerRoutes from './routes/sudoers.js';
import sessionRoutes from './routes/sessions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false } });

app.use(helmet({ contentSecurityPolicy: false, hsts: { maxAge: 31536000, includeSubDomains: true } }));
app.use(cors({ origin: false }));
app.use(express.json({ limit: '100kb' }));

// 1. Auth config endpoint (public — frontend needs this before login)
app.get('/auth/config', (req, res) => {
  res.json({
    accountsUrl: process.env.ACCOUNTS_URL,
    clientId: process.env.OAUTH_CLIENT_ID,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
    postLogoutRedirectUri: process.env.OAUTH_POST_LOGOUT_REDIRECT_URI || '',
  });
});

// 2. Auth proxy routes (no auth — SDK uses these for token exchange)
app.use('/auth/proxy', authProxyRouter);

// 3. Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 4. Rate limiters
const apiLimiter = rateLimit({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
const passwordLimiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/users/:username/password', passwordLimiter);

const destructiveLimiter = rateLimit({ windowMs: 60000, max: 5, standardHeaders: true, legacyHeaders: false });
app.delete('/api/users/:username', destructiveLimiter);
app.delete('/api/groups/:groupname', destructiveLimiter);
app.delete('/api/sudoers/:username', destructiveLimiter);
app.delete('/api/sessions/:terminal(*)', destructiveLimiter);

// 5. Auth middleware (protects all /api/* except /api/health which is above)
if (process.env.ACCOUNTS_URL) {
  app.use('/api', createAuthMiddleware());
}

// 6. Protected routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sudoers', sudoerRoutes);
app.use('/api/sessions', sessionRoutes);

// API 404 — must come after all /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// 7. Static files + SPA catch-all (LAST)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// WebSocket auth
if (process.env.ACCOUNTS_URL) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const response = await fetch(`${process.env.ACCOUNTS_URL}/api/proxy/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return next(new Error('Invalid token'));
      socket.user = await response.json();
      next();
    } catch {
      next(new Error('Authentication service unavailable'));
    }
  });
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// File watcher
const watchers = startWatcher(io);

// Start server
const PORT = process.env.PORT || 9995;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  watchers.userWatcher.close();
  watchers.groupWatcher.close();
  io.close();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, io, server };
