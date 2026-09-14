# 결과 — impl 24th: 회차간 상관분석 `.env` 변수 미적용 보고 (PRD v1.11.1) — 2026-09-14

## 시도 1 — PASS 5/5

| id | 판정 | 근거 |
|---|---|---|
| 24-1 | PASS (원인 확정) | `.env.local` `LOTTO_CROSS_DRAW_LAG=5`(기본값과 동일, 변경된 적 없음). 재분석 run 3개 모두 `max_lag=5` → **엔진 적용은 정상**. `GET /config` 응답과 설정 화면에 `lotto_cross_draw_lag` 가 없어 사용자가 적용 여부를 확인할 수 없었음 = "미적용"으로 보인 원인. 부수 발견: `lotto_min_effect_delta`·`lotto_run_retention` 도 미노출 |
| 24-2 | PASS | `api/router.py` 세 키 추가, `test_openapi_contract` 타입 단언 확장. 라이브 `GET /config` → `lotto_cross_draw_lag 5 · lotto_min_effect_delta 0.25 · lotto_run_retention 20` |
| 24-3 | PASS | `Settings.tsx` CONFIG_HELP 4행(timezone 포함) |
| 24-4 | PASS | `CrossDraw.test.tsx` +2: L 7 vs 2 → `role=note` "L=2 … LOTTO_CROSS_DRAW_LAG 는 7", KPI "설정 L=7"; 일치 시 note 없음 |
| 24-5 | PASS | pytest 74/74 · vitest 44/44 · ruff/mypy/eslint/tsc clean |

## 변경 파일
- backend `api/router.py`; test `test_openapi_contract.py`
- frontend `api/client.ts`(AppConfig 3 필드), `pages/Settings.tsx`, `pages/CrossDraw.tsx`(config 조회·불일치 안내·KPI), `pages/CrossDraw.test.tsx`
- docs `.docs/PRD.md` v1.11.1(§10·변경 이력), `README.md`/`README.en.md`(env 표·테스트 표·트러블슈팅)

## 비고
- 값을 실제로 바꾸려면: `.env.local` 수정 → `make local-restart`(uvicorn reload 는 .env 미감시) → 설정 화면에서 값 확인 → 새 run 또는 `make reanalyze`. 기존 run 은 생성 시점 L 로 고정.
- `.env.local` 값은 사용자 데이터라 이번 작업에서 변경하지 않음.
