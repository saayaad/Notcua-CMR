import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          ['/node_modules/react/', '/node_modules/react-dom/', '/node_modules/scheduler/'].some((part) =>
            id.includes(part),
          )
            ? 'react-vendor'
            : id.includes('/node_modules/@firebase/') || id.includes('/node_modules/firebase/')
              ? 'firebase-auth'
              : undefined,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3333', '/socket.io': { target: 'http://127.0.0.1:3333', ws: true } },
  },
});
