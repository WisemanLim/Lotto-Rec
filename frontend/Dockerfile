# Lotto-Rec frontend — Vite dev 서버(컨테이너), /api 는 VITE_API_BASE(=http://api:8000) 로 프록시. pnpm-lock 고정.
FROM node:22-slim
WORKDIR /srv/lotto/frontend
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
