# 결과 — impl 29th: S5.8 최근 당첨번호 회차 수 `.env` 관리 (PRD v1.14.1) — 2026-09-14

## 시도 1 — PASS 5/5 (수정 0)

| id | 판정 | 근거 |
|---|---|---|
| 29-1 | PASS | `Settings.lotto_recent_draws = Field(default=5, ge=1, le=20)`. `LOTTO_RECENT_DRAWS=3 → 3`, `=99 → ValidationError "Input should be less than or equal to 20"` |
| 29-2 | PASS | 라이브 `GET /api/v1/config` → `lotto_recent_draws: 5`(기본), `test_core_response_shapes` 에 `("lotto_recent_draws", int)` 추가 → pytest 76/76 |
| 29-3 | PASS | `MyNumbers.recent.test.tsx`: `/config` mock `lotto_recent_draws: 3` → list 3행(1241~1239), `/data/draws` 요청 1회 `limit=3`(config 로드 전 선요청 없음 — `enabled: config.isSuccess`) |
| 29-4 | PASS | `CONFIG_HELP.lotto_recent_draws`, `.env.local.example` 행, README(한/영) §env 표, PRD §10 행 + §16.4 1.14.1 |
| 29-5 | PASS | `make test` pytest 76 · vitest 46 (`logs/make-test.log`), tsc·eslint 0 |

## 변경 파일
`backend/app/core/config.py`, `backend/app/api/router.py`, `test/backend/test_openapi_contract.py`, `frontend/src/api/client.ts`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/MyNumbers.tsx`(상수 `RECENT_DRAWS` 제거 → config), `frontend/src/pages/MyNumbers.recent.test.tsx`, `.env.local.example`, `.docs/PRD.md`, `README.md`, `README.en.md`

## 후속
사용자 `.env.local` 에 `LOTTO_RECENT_DRAWS=4` 설정 후 미적용 보고 → impl/31st(uvicorn 이 `.env.local` 을 감시하지 않던 문제).
