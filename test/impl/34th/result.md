# 결과 — impl 34th: 추천 정합성 분석 (PRD v1.16 S8.7~S8.9) — 2026-09-21

## 시도 1 — PASS 8/8

| id | 판정 | 근거 |
|---|---|---|
| 34-1 | PASS | `test_uniform_random_tickets_are_consistent` |
| 34-2 | PASS | `test_leaky_strategy_is_flagged_with_next_experiment` |
| 34-3 | PASS | `test_uniform_deviation_points_to_data_not_strategy` |
| 34-4 | PASS(1 수정) | 실데이터(user, 2회차) 스모크에서 '구별되지 않음' 문구가 표본 부족을 가림 → n_tests=0 이면 '판정 보류' 문구로 수정, 테스트 추가 |
| 34-5 | PASS | `test_consistency_api_from_outcomes` |
| 34-6 | PASS | `ConsistencyPanel.test.tsx` 2건 |
| 34-7 | PASS | 라이브 DB: backtest 8전략 각 2,400장·240회, 검정 64개 BH 보정 후 유의 편차 0(최소 q 0.207 = low_competition 일치수 GOF p 0.003 이 BH 후 소멸). user 출처는 30장·2회차라 insufficient |
| 34-8 | PASS | pytest 88 passed, vitest 54 passed, mypy OK, ruff 는 기존 test_engine.py 3건만 |

## 비고
- 등수 검정은 티켓 독립 근사, 번호·번호쌍 검정은 회차 단위 t 검정(회차 독립)으로 유효성이 더 높다.
- 정합성 분석은 생성기 파라미터를 자동 변경하지 않는다(S8.9). 유의 편차 시 E9 실험 → 홀드아웃 검증 → 활성화 절차.
