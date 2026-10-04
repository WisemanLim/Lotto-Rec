# 시나리오 — impl 50th: SEED 값 생성 새로고침 버그 수정 + 환경별 docker compose 빌드 (PRD v1.32 S4.13·S7.2) — 2026-10-04

| id | 케이스 | 기대 |
|---|---|---|
| 50-1 | 원인 재현 근거(`.make/honcho.log`) | done 시 `.env.local` 갱신 직후 uvicorn `WatchFiles ... Reloading` + `[vite] ../.env.local changed, restarting server` → 이후 상태 조회 404 |
| 50-2 | 재기동 모사(`_jobs` 비움) 후 상태 조회·중지 | 스냅샷으로 200, done·seed·ticket 동일 |
| 50-3 | 스냅샷 기록 순서 | `.env.local` 갱신 호출 시점에 스냅샷 파일 이미 존재 |
| 50-4 | 비 uuid job_id | 404 (경로 조작 차단) |
| 50-5 | Vite env 감시 제외 | 패치 config: 루트 `.env.development` 생성·삭제 시 재시작 로그 없음 / 대조군(ignored 제거): `restarting server` 2회 |
| 50-6 | honcho 실구동 E2E | 5173 프록시로 seed-search(4등) → 30초 폴링 전부 200, backend 재기동 1회, Vite 재시작 0회 |
| 50-7 | `make dev-build`·`make prod-build` | `.env.<env>` 자동 생성, 각 프로젝트 api healthy·web 기동, `/health` env=dev/prod, 포트 18000/15173·38000/35173, DB `data/lotto-<env>.db` 1240회 적재 |
| 50-8 | prod 환경 seed-search 스모크 | done, `env_updated=false`(컨테이너에 .env.local 없음), 스냅샷 `data/cache-prod/seed_search/` |
| 50-9 | `make local-build` → `make local-stop` | 기본 프로젝트 컨테이너 기동, `/health` env=local, local-stop 이 컨테이너까지 정리 |
| 50-10 | `make db-migrate ENV=prod` · `make <env>-stop` | 호스트 alembic 이 `.env.prod` DB 대상 성공, 컨테이너·네트워크 제거 |
| 50-11 | 회귀 | `make test`·`make lint` 통과 |
