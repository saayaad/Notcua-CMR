import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, '.audit/phase3-site');
await build({
  configFile: false,
  envFile: false,
  root: resolve(root, 'e2e/fixtures'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: output,
    emptyOutDir: false,
    rollupOptions: { input: resolve(root, 'e2e/fixtures/phase3-editor.html') },
  },
});
const server = await preview({
  configFile: false,
  envFile: false,
  root,
  build: { outDir: output },
  preview: { host: '127.0.0.1', port: 5188, strictPort: true },
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.httpServer.closeAllConnections();
    server.httpServer.close(() => process.exit(0));
  });
