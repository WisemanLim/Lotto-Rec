# dev-env 시나리오 — Lotto-Rec (custom: python-fastapi + react, SQLite, local 전용)

| # | 케이스 | 명령 | 기대 결과 | 결과 |
|---|---|---|---|---|
| 1 | 도구 점검 | `make preflight` | Python 3.12+, uv, Node 22+, pnpm 확인. Docker 는 WARN 허용 | ☐ |
| 2 | 의존성 설치 | `make local-build` | `backend/uv.lock`, `frontend/pnpm-lock.yaml` 생성, `.env.local` 존재 | ☐ |
| 3 | DB 마이그레이션 | `make db-migrate` | `data/lotto.db` 생성, alembic head 적용(초기엔 빈 리비전) | ☐ |
| 4 | 기동 | `make local-all` | honcho pid 파일 생성, web(8000)·frontend(5173) 로그 출력 | ☐ |
| 5 | 헬스 체크 | `curl -s http://127.0.0.1:8000/health` | `{"status":"ok","env":"local"}` | ☐ |
| 6 | 설정 API | `curl -s http://127.0.0.1:8000/api/v1/config` | `lotto_number_recommendation_count: 10`, `mc_iterations.deep: 500000` | ☐ |
| 7 | 프론트 접속 | 브라우저 `http://127.0.0.1:5173` | 제목 "Lotto-Rec", backend status ok, 설정 값 표시 | ☐ |
| 8 | 상태/로그 | `make local-ps`, `make local-logs` | 프로세스 running, 통합 로그 tail | ☐ |
| 9 | 테스트 | `make test` | pytest 8건 PASS(health 2 + 이론값 6), vitest 1건 PASS | ☐ |
| 10 | 린트 | `make lint` | ruff/mypy/eslint/tsc 오류 0 | ☐ |
| 11 | 종료 | `make local-stop` | pid 파일 제거, 포트 8000/5173 해제 | ☐ |
| 12 | 재현성 | `make db-reset && make db-migrate` | SQLite 재생성 성공 | ☐ |

결과 로그는 `test/dev-env/logs/`(git 제외)에 저장. 결과 요약은 `test/dev-env/result.md` 로 작성.
