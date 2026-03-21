import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: false },
});

app.use(cors({ origin: false }));
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 9998;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  io.close();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, io, server };
