# 결과 — impl 50th: SEED 값 생성 새로고침 버그 수정 + 환경별 docker compose 빌드 (PRD v1.32) — 2026-10-04

## 시도 1 — PASS 11/11

| id | 판정 | 근거 |
|---|---|---|
| 50-1 | PASS(원인 확정) | 14:28:34 `WatchFiles detected changes in '.../.env.local'. Reloading...` → 같은 초 `[vite] ../.env.local changed, restarting server...` → 14:28:38 `GET /seed-search/decd083d… 404` |
| 50-2 | PASS | `test_seed_search_status_survives_restart_via_snapshot` |
| 50-3 | PASS | `test_seed_search_snapshot_written_before_env_local` |
| 50-4 | PASS | `test_seed_search_snapshot_rejects_non_uuid_job_id` |
| 50-5 | PASS | 패치: 재시작 로그 없음 / 대조군: `../.env.development changed, restarting server...` 2회 |
| 50-6 | PASS | job 11ff00ef: 1s running → 이후 29회 done, 30회 모두 200. 14:55:15 backend reload 1회, Vite 재시작 0회. 테스트 후 `.env.local` 의 `LOTTO_RANDOM_SEED` 원래 값(2541911)으로 복원 |
| 50-7 | PASS | dev: `{"status":"ok","env":"dev"}`, prod: `{"status":"ok","env":"prod"}`, 두 환경 `latest_result_draw=1240` |
| 50-8 | PASS | iterations 16, `env_updated:false`, 스냅샷 파일 생성 |
| 50-9 | PASS | `{"status":"ok","env":"local"}` → local-stop 후 lotto 컨테이너 0 |
| 50-10 | PASS | alembic SQLiteImpl 정상, `lotto-rec-dev_default`·`lotto-rec-prod_default` 네트워크 제거 |
| 50-11 | PASS | pytest 130 passed, vitest 95 passed, ruff·mypy·eslint·tsc 무오류 |

## 설계 결정
- `.env.local` 즉시 재기동(v1.14.3, 사용자 요청)을 유지하기 위해 uvicorn 감시는 그대로 두고, 잡 결과를 재기동에서 살아남게 함(종료 스냅샷). 프론트는 env 감시가 불필요해 Vite 감시에서 제외.
- `local-build` 의미 변경(호스트 의존성 설치 → docker 빌드·구동). 기존 동작은 `local-install`.
- 환경별 compose 프로젝트·포트·SQLite·캐시 분리 — 동시 구동 가능. web 은 모든 환경에서 Vite dev 서버(정적 빌드 서빙은 범위 밖).
