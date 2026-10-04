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
      // v1.32 버그 수정: 루트 .env* 변경으로 dev 서버가 재시작되면 브라우저가 전체 새로고침된다.
      // 'SEED 값 생성' 완료 시 백엔드가 .env.local(LOTTO_RANDOM_SEED)을 갱신하므로 화면 상태가 날아갔다.
      // 프론트가 쓰는 VITE_* 값(VITE_TIMEZONE 은 /config 가 덮어씀)은 env 감시가 필요 없어 제외한다.
      watch: { ignored: ['**/.env', '**/.env.*'] },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
