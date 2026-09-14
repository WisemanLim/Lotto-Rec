# 결과 — impl 19th: 내 번호 보너스 포함 평가 백색 화면 수정 (PRD v1.9.1) — 2026-09-14

## 시도 1 — PASS 4/4

| id | 판정 | 근거 |
|---|---|---|
| 19-1 | PASS (원인 확정) | live `POST /user/tickets/evaluate {numbers,bonus:7}` → 200 이지만 `bonus` = `{'bonus':7,'in_main':False,'observed_as_main':170,'_':0}`(dict). `ScorecardView` 의 `<BallRow bonus={sc.bonus}>` 가 객체를 자식으로 렌더 → React 크래시 → 백색 화면. 보너스 없으면 null 이라 정상이었음 |
| 19-2 | PASS | `core/recommend/scorecard.py`: `bonus` int\|null, `bonus_info` {in_main, observed_as_main} 분리(디버그 키 `_` 제거). pytest `test_user_ticket_evaluate_save_and_tracking` 에 회귀 단언 추가. live 재확인: `bonus=7 bonus_info={'in_main': False, 'observed_as_main': 170}` |
| 19-3 | PASS | `ScorecardView.test.tsx` 2건: 보너스 공(aria-label '보너스 7') + "본번호로 출현 160회" 표시, bonus 가 객체여도 크래시 없음(`typeof === 'number'` 방어) |
| 19-4 | PASS | pytest 63/63 · vitest 37/37 (15 files) · ruff/mypy/eslint/tsc clean · `pnpm build` OK · OpenAPI 경로 스냅샷 불변 |

## 변경 파일
- backend `app/core/recommend/scorecard.py`; test `test/backend/test_recommend_tracking_validation.py`
- frontend `api/client.ts`(Scorecard.bonus_info), `components/ScorecardView.tsx`(방어 렌더 + 보너스 정보 문구), `components/ScorecardView.test.tsx`(신규)
- docs `.docs/PRD.md` v1.9.1(API 표·변경 이력), `README.md`/`README.en.md`(impl/19th 행·트러블슈팅)

## 비고
- 저장된 티켓의 `scorecard`(`_compact`)는 bonus 를 담지 않아 기존 데이터 영향 없음.
- uvicorn reload 가 반영하므로 별도 재기동 불필요했으나, 오래 띄운 서버라면 `make local-restart`.
