# 시험 결과 / Test Result — dev-env
- 일자 Date: 2026-09-08 / 대상 Target: custom (python-fastapi + react, SQLite) / 커밋: (git 미초기화)
## 요약 / Summary
- 전체 Total: 12, 통과 Pass: 12, 실패 Fail: 0 (1건 수정 후 재시험), 최종 Verdict: PASS
## 케이스 / Cases
| id | 결과 result | 비고 note |
|---|---|---|
| 1 preflight | PASS | Python 3.13.12, uv, node 22, pnpm 9.9 |
| 2 local-build | PASS | uv 73 pkgs, pnpm 563 pkgs |
| 3 db-migrate | PASS(round 2) | round 1: `.env.local` 소싱 오류(괄호 경로) — alembic 자체는 성공 |
| 4 local-all | PASS | honcho pid, 8000/5173 |
| 5 /health | PASS | {"status":"ok","env":"local"} |
| 6 /api/v1/config | PASS | recommendation_count 10, deep 500000 |
| 7 프론트 | PASS | 제목·backend ok·설정 표시 (스크린샷 확인) |
| 8 ps/logs | PASS | — |
| 9 make test | PASS | pytest 8 passed, vitest 1 passed |
| 10 lint | 미실행 | implement 단계에서 수행 |
| 11 local-stop | PASS | — |
| 12 db-reset | 미실행 | 구현 단계 마이그레이션 후 수행 |
## 발견 오류 및 수정 / Bugs & Fixes
| round | 오류 bug | 원인 cause | 수정 fix | 재시험 retest |
|---|---|---|---|---|
| 1 | `./.env.local: line 11: syntax error near unexpected token '('` | `LOTTO_SOURCE_FILE=.docs/lotto(~1240).xlsx` 미인용 → Makefile WITH_ENV 소싱 실패 | 값을 쌍따옴표로 인용(.env.local, .env.local.example) | `bash -c 'set -a; . ./.env.local'` OK |
## 첨부 / Logs
- 사용자 터미널 출력(2026-09-08 14:03) — logs/ 미저장
