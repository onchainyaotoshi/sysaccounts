import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startWatcher } from './watcher.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import sudoerRoutes from './routes/sudoers.js';
import sessionRoutes from './routes/sessions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false } });

app.use(cors({ origin: false }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hostname: os.hostname() });
});

// Rate limit BEFORE routes
const passwordLimiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/users/:username/password', passwordLimiter);

const sessionKillLimiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/sessions/:terminal', sessionKillLimiter);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sudoers', sudoerRoutes);
app.use('/api/sessions', sessionRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// WebSocket
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// File watcher
const watchers = startWatcher(io);

// Start server
const PORT = process.env.PORT || 9998;
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
