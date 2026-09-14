# 시나리오 — impl 29th: S5.8 최근 당첨번호 회차 수 `.env` 관리 (PRD v1.14.1) — 2026-09-14

| id | 케이스 | 수용 기준 |
|---|---|---|
| 29-1 | Settings | `LOTTO_RECENT_DRAWS` (기본 5, 1–20) → `settings.lotto_recent_draws`; 범위 밖 값은 기동 실패(pydantic) |
| 29-2 | /config 노출 | `GET /api/v1/config` 에 `lotto_recent_draws: int` (계약 테스트 `test_core_response_shapes`) |
| 29-3 | 프론트 | MyNumbers 는 `/config` 로드 후 `limit=<lotto_recent_draws>` 로 **1회만** 요청, 목록 행수 = N (vitest, N=3 mock) |
| 29-4 | 설정 화면·문서 | `CONFIG_HELP.lotto_recent_draws`, `.env.local.example`, README(한/영) env 표, PRD §10 |
| 29-5 | 회귀 | `make test` 전체 PASS, tsc·eslint 0 |
