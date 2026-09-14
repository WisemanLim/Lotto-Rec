# 결과 — impl 25th: S4.11 추천 생성(순차) (PRD v1.12) — 2026-09-14

## 시도 1 — 4/5 → 시도 2 — PASS 5/5

| id | 판정 | 근거 |
|---|---|---|
| 25-1 | PASS | `test_sequential_runs_all_strategies_in_catalog_order` |
| 25-2 | PASS | `test_sequential_saves_per_strategy_and_reports_failures` |
| 25-3 | PASS | `Recommend.sequential.test.tsx`: 같은 부모 슬롯·DOM 순서 뒤, body {save, count:10}, `strategy`/`include_control` 키 없음 |
| 25-4 | PASS | 같은 테스트: 요약 role=status "2전략 · 4장 · 대상 1242회 … 실패 1", 결과 제목 2건 |
| 25-5 | 시도 1 FAIL → 시도 2 PASS | 시도 1: 무관 테스트 `test_cross_draw_lag_setting_from_env` 가 `.env.local` 기본값 5 를 가정했는데 사용자가 `LOTTO_CROSS_DRAW_LAG=30` 으로 변경 → 필드 기본값(`model_fields[...].default`) 단언으로 수정. 시도 2: pytest 76/76 · vitest 45/45 · ruff/mypy/eslint/tsc clean · 스냅샷 45. 라이브 `POST /recommend/sequential {count:1, save:false}` → 9전략 · 9장 · failed [] · 대상 1242 |

## 변경 파일
- backend `services/recommend_service.py`(`recommend_sequential`), `api/recommend.py`(`POST /sequential`, `SequentialIn`); test `test_recommend_sequential.py`(신규), `test_cross_draw.py`(env 기본값 단언 수정), `openapi_paths.snapshot.json`(+1)
- frontend `pages/Recommend.tsx`(결과 블록을 `RecommendResultSection` 컴포넌트로 추출·재사용, `seq` mutation, 버튼, 요약), `api/client.ts`(`SequentialIn`/`SequentialResponse`, `recommend.sequential`), `pages/Recommend.sequential.test.tsx`(신규)
- docs `.docs/PRD.md` v1.12(S4.11·§11·변경 이력), `README.md`/`README.en.md`

## 가정(기본값)
- 순차 생성은 폼의 개수·seed·최대 공유·저장 옵션을 그대로 쓰고 **균등 기준선 체크박스는 무시**(목록의 `uniform` 전략이 기준선).
- 같은 seed 를 모든 전략에 적용(전략별 가중치가 달라 티켓은 다름). 전략별 batch 로 저장돼 S4.10 자동 등록의 '전략별 최신 batch' 와 호환.
- 서버 단일 요청으로 처리(진행률 표시 없음, 9전략 수 초 소요). 한 전략 실패 시 rollback 후 계속.
