// Lotto-Rec — PM2 process manager (PROC_MGR=pm2 대안; 기본은 honcho/Procfile.dev)
// 실행: make local-all PROC_MGR=pm2  (= npx pm2 start ecosystem.config.cjs)
module.exports = {
  apps: [
    {
      name: 'lotto-rec-backend',
      cwd: './backend',
      script: 'uv',
      args: 'run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000',
      interpreter: 'none',
    },
    {
      name: 'lotto-rec-frontend',
      cwd: './frontend',
      script: 'pnpm',
      args: 'dev --host 127.0.0.1 --port 5173',
      interpreter: 'none',
    },
    // 워커 예시(P2): { name: 'lotto-rec-worker', cwd: './backend', script: 'uv', args: 'run python -m app.worker', interpreter: 'none' },
  ],
};
