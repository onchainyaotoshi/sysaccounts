import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:9998',
      '/auth': 'http://localhost:9998',
      '/socket.io': {
        target: 'http://localhost:9998',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
