# 시나리오 — impl 27th: S7.1 docker compose 구동 (PRD v1.13, 사용자 요청 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 27-1 | compose 유효성 | `docker compose --env-file .env.local --profile app config` | 서비스 api·web, `.env.local` 값 주입(따옴표 제거된 `LOTTO_SOURCE_FILE`), 포트 = LOTTO_*_PORT, 볼륨 ./data·./.docs → /srv/lotto | P0 |
| 27-2 | 빌드 | `make docker-build` / `docker-all` | uv.lock·pnpm-lock 고정 설치, 호스트 .venv/node_modules 미포함(.dockerignore) | P0 |
| 27-3 | 마이그레이션 자동 | api 컨테이너 로그 | `[entrypoint] alembic upgrade head` 후 uvicorn 기동, DB = 호스트 ./data/lotto.db(alembic 헤드 = 5b12a3e10f18) | P0 |
| 27-4 | 헬스·API | `GET :18000/health`, `GET :18000/api/v1/data/summary` | 200, max_draw 1241(호스트 DB 공유) | P0 |
| 27-5 | 프론트 프록시 | `GET :15173/`, `GET :15173/api/v1/config` | HTML 200, 프록시로 api 응답(`lotto_cross_draw_lag` 포함) | P0 |
| 27-6 | make 타겟 | `docker-ps`, `docker-migrate`, `docker-logs`, `docker-stop` | 상태 표시 / 마이그레이션만 실행(no-op) / 정리 후 컨테이너 없음, 호스트 데이터 유지 | P0 |
| 27-7 | 충돌 점검 | honcho 실행 중 + 포트 미지정 `make docker-all` | 안내 메시지 후 종료(exit 1) | P1 |
| 27-8 | 회귀 | `make test`, `make lint` | 소스 변경 없음 → PASS 유지 | P0 |
