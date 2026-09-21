# 결과 — impl 37th: 진행 예정 회차만 동작하는 방어 코드 (PRD v1.19) — 2026-09-21

## 시도 1 — PASS 8/8 (3 수정)

| id | 판정 | 근거 |
|---|---|---|
| 37-1 | PASS | `test_reset_recommendations_rejected_for_completed_draw` (기존 outcome 삭제 시험은 이 방어로 대체) |
| 37-2 | PASS | `test_reset_tickets_by_draw` 400 단언 |
| 37-3 | PASS(1 수정) | `test_auto_register_rejected_for_completed_draw`. 첫 구현에서 지역 변수 `latest` 가 함수 뒤쪽 변수와 충돌(mypy 5건) → `latest_result` 로 개명 |
| 37-4 | PASS(1 수정) | `Recommend.history.test.tsx` 방어 시험. 기존 시험은 버튼이 데이터 로드 후 활성화되므로 활성 대기 추가 |
| 37-5 | PASS | 동 시험: 필터 1241 선택 → 비활성 + '결과가 입력된 회차' 툴팁 |
| 37-6 | PASS | `MyNumbers.reset.test.tsx` 1242 선택 → 비활성, DELETE 0건 |
| 37-7 | PASS(1 수정) | `Tracking.filter.test.tsx`. 첫 시험은 '로딩 중' 사유로 비활성이 먼저 성립 → 사유 문구를 기다리도록 수정 |
| 37-8 | PASS | vitest·pytest 결과는 `logs/pytest_full.log` 및 아래 요약 |

## 비고
- 버튼 활성 조건은 최신 결과 회차 + 1 이상이면서 해당 회차에 저장된 추천(또는 내 번호)이 있을 때. 로딩 중에는 비활성.
- 추천 초기화는 필터와 무관하게 항상 진행 예정 회차(최신+1) 기준이다.
