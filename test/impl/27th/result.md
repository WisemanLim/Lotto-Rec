# 결과 — impl 27th: S7.1 docker compose 구동 (PRD v1.13) — 2026-09-14

## 시도 1 — 1 수정 후 PASS 8/8

| id | 판정 | 근거 |
|---|---|---|
| 27-1 | PASS (1 수정) | `config` 첫 실행: `healthcheck.test must start either by "CMD"` → `["CMD", ".venv/bin/python", …]` 로 수정. 이후 서비스 api·web, `LOTTO_SOURCE_FILE: .docs/lotto(~1240).xlsx`(따옴표 제거), `LOTTO_CROSS_DRAW_LAG: "30"`, published 8000/5173(.env.local), 볼륨 `./data`·`./.docs` → `/srv/lotto/…` |
| 27-2 | PASS | `LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all` → 이미지 lotto-rec-api 2.13GB(numpy/scipy/statsmodels), lotto-rec-web 823MB. `.dockerignore` 로 호스트 `.venv`·`node_modules` 제외 |
| 27-3 | PASS | api 로그: `[entrypoint] alembic upgrade head (DATABASE_URL=sqlite:///./data/lotto.db)` → `Context impl SQLiteImpl` → `[entrypoint] uvicorn 0.0.0.0:8000` → `Uvicorn running`. 호스트 DB 는 이미 head 라 no-op. **빈 DB 검증**: `DATABASE_URL=sqlite:////srv/lotto/data/_fresh_test.db` 로 `alembic upgrade head` → `Running upgrade` 3단계, `alembic_version=5b12a3e10f18`, draws 0 (임시 파일 삭제) |
| 27-4 | PASS | `:18000/health` `{"status":"ok","env":"local"}`, `data/summary` max_draw 1241 · total 1241(호스트 DB 공유), `config` lotto_cross_draw_lag 30 · 추천 개수 20 (.env.local 주입) |
| 27-5 | PASS | `:15173/` HTML 200, `:15173/api/v1/config` 프록시 → lag 30, `analysis/runs/latest?cohort=ALL` → 1~1241 done |
| 27-6 | PASS | `docker-ps` api healthy·web up, `docker-migrate`(run --rm, no-op 정상), `docker-stop` 후 컨테이너 0, 호스트 `data/` (lotto.db·cache·backup) 유지, honcho backend 여전히 max_draw 1241 |
| 27-7 | PASS | honcho 실행 중 + 포트 미지정 `make docker-all` → "honcho 가 실행 중(pid …) — 같은 포트…" 안내, `make: *** [docker-all] Error 1` |
| 27-8 | PASS | `make test` pytest 76/76 · vitest 45/45 (소스 변경 없음) |

## 변경 파일
- `backend/Dockerfile`(uv.lock `--frozen --no-dev`, WORKDIR `/srv/lotto/backend`, HEALTHCHECK, ENTRYPOINT), `backend/docker-entrypoint.sh`(신규: alembic → 선택 seed → uvicorn), `backend/.dockerignore`(신규)
- `frontend/Dockerfile`(corepack pnpm@9.9.0, `pnpm-lock.yaml --frozen-lockfile`, WORKDIR `/srv/lotto/frontend`), `frontend/.dockerignore`(신규)
- `docker-compose.yml`(api env/volumes/healthcheck, web `VITE_API_BASE=http://api:8000`·`depends_on: service_healthy`)
- `Makefile`(`DCL`, `DOCKER_PORT_CHECK`, `docker-all/build/logs/stop/restart/ps/migrate/seed/reanalyze`)
- docs `.docs/PRD.md` v1.13(S7.1·§7·§8.2·변경 이력), `README.md`/`README.en.md`(빠른 시작 docker·Make 표·트러블슈팅·구조)

## 가정(기본값)
- web 컨테이너는 **Vite dev 서버**(빌드+nginx 아님) — 현재 환경 구동이 목적이며 소스는 이미지에 COPY(HMR 없음, 소스 변경 시 `make docker-all` 재빌드).
- api 컨테이너는 `--reload` 없음. 설정(`.env.local`) 변경은 `make docker-restart SVC=api`.
- 시드는 기본 비활성(`LOTTO_DOCKER_SEED=1` 명시 시 전체 회차 적재, 멱등). 재분석 자동 실행 없음(`make docker-reanalyze` 별도).
- 호스트 `./data` 를 그대로 마운트하므로 honcho 와 docker 가 **같은 SQLite 파일**을 공유(동시 실행 시 쓰기 경합 주의 — 포트 충돌 안내가 사실상 동시 실행을 막음).
