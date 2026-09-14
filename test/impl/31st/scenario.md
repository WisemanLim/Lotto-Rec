# 시나리오 — impl 31st: `.env.local` 변경 즉시 반영 (사용자 보고, PRD v1.14.3) — 2026-09-14

보고: `.env.local` `LOTTO_RECENT_DRAWS=4` 로 수정했으나 화면은 5회차 유지.

| id | 케이스 | 수용 기준 |
|---|---|---|
| 31-1 | 원인 재현 | 라이브 `/config` `lotto_recent_draws` 가 `.env.local` 값과 다름(5 vs 4), uvicorn 로그에 `.env.local` 변경 감지 없음 |
| 31-2 | 수정 | Procfile `--reload-dir .. --reload-include .env --reload-include .env.local --reload-exclude ../frontend ../data ../test` → 기동 로그 "Will watch … Lotto-Rec" |
| 31-3 | 즉시 반영 | `.env.local` 값 변경(4→6→4) 시 `WatchFiles detected changes in '…/.env.local'. Reloading...` 후 수 초 내 `/config` 반영, 화면 행수 일치 |
| 31-4 | 재기동 안정성 | `make local-restart` 가 `Address already in use` 없이 재기동(이전 uvicorn 종료 대기) |
