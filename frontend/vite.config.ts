import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// .env.local 은 프로젝트 루트(../)에서 로드 (VITE_ 접두어만 노출).
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, ['VITE_', 'LOTTO_']);
  const apiBase = env.VITE_API_BASE ?? `http://127.0.0.1:${env.LOTTO_BACKEND_PORT ?? '8000'}`;
  return {
    plugins: [react()],
    envDir,
    envPrefix: 'VITE_',
    server: {
      host: '127.0.0.1',
      port: Number(env.LOTTO_FRONTEND_PORT ?? 5173),
      proxy: { '/api': { target: apiBase, changeOrigin: true }, '/health': { target: apiBase } },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
