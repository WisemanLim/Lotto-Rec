#!/bin/sh
# Lotto-Rec api 컨테이너 엔트리포인트 (PRD S7.1): 마이그레이션 → (선택) 시드 → uvicorn
set -e
cd /srv/lotto/backend
mkdir -p /srv/lotto/data/cache
echo "[entrypoint] alembic upgrade head (DATABASE_URL=${DATABASE_URL:-sqlite:///./data/lotto.db})"
uv run --no-sync alembic upgrade head
if [ "${LOTTO_DOCKER_SEED:-0}" = "1" ]; then
  echo "[entrypoint] seed: ${LOTTO_SOURCE_FILE:-.docs/lotto(~1240).xlsx} (전체 회차, 멱등)"
  uv run --no-sync python -m app.seed --all
fi
echo "[entrypoint] uvicorn 0.0.0.0:8000"
exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
