# 결과 — impl 40th: 추천 'SEED 값 생성' 무작위 탐색 (PRD v1.22 S4.13) — 2026-09-27

## 시도 1 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 40-1 | PASS | `test_seed_search.py`(API), `Recommend.seedsearch.test.tsx`(필드 순서), 라이브 캡처 `logs/recommend-form2.png` — 요청한 순서 그대로 렌더 |
| 40-2 | PASS | `test_seed_search_rank5_completes_and_fills_seed`(백엔드), `Recommend.seedsearch.test.tsx`(폴링→완료 시 seed 입력칸 채움). 라이브 확인: `POST /recommend/seed-search {target_draw_no:1000,target_rank:5}` → 168회 만에 완료(23ms), `matched_ticket` 6개, seed=168 |
| 40-3 | PASS | `test_seed_search_invalid_target_rank_422`(6은 거부), 프론트 희망 등수 기본값 1·전송값 반영 시험 |
| 40-4 | PASS | `test_seed_search_stop_before_match`(1등 목표 즉시 중지 → stopped, seed=null), 프론트 버튼 라벨 전환·재클릭 중지 시험 |
| 40-5 | PASS | `test_seed_search_rejects_missing_previous_draw`(대상 1회·999999회 → 400) |
| 40-6 | PASS | pytest 97 passed(하단 로그), vitest 76 passed, tsc·eslint·mypy 무오류. ruff 는 기존 test_engine.py 3건만(본 변경 무관) |

## 성능 벤치마크 (참고)
실 DB 컨텍스트(1~999회 이력)로 20만 회 측정: 약 15,200 iter/s. 1등(6개 일치, 기대 시행 수 8,145,060회) 목표의 기대 소요시간은 **약 9분**(워스트케이스 상한 `LOTTO_SEED_SEARCH_MAX_ITER`=20,000,000 도달 시 약 22분에 자동 중지). 그래서 사용자 우려대로 1등 목표는 실제로 오래 걸릴 수 있어 중지 버튼과 희망 등수 하향 옵션이 유효하다. 5등(3개 일치, 기대 ≈7.75회)은 라이브에서 168회·23ms 만에 즉시 완료.

## 설계 결정 (가정)
- **잡 저장 방식**: DB 테이블 대신 **서버 인메모리 잡**(서버 재시작 시 소멸, TTL 30분 후 정리)으로 구현. 분석 run 처럼 영속화할 필요가 없는 1회성 유틸리티라 판단.
- **성능 단순화**: 전략별 실제 `generate()`(커버리지 제약·전형성 재표본·당첨자수 모형 후보 랭킹)를 그대로 쓰면 수백만 회 반복이 비현실적으로 느려, 전략 기본 가중치로 **1회 비복원추출**만 수행(`hybrid`→`bayesian_shrink`, `low_competition`→`uniform` — `winners_model` 미보유 시 기존 로직의 폴백과 동일 대체). `pair_association` 만 기본 파라미터의 순차 Lift 가중을 그대로 적용. PRD S4.13 에 명시.
- **탐색 자체의 무작위성**: OS 엔트로피 시드(`np.random.default_rng()`, 인자 없음) 사용 — 반복 재현 대상은 탐색 결과인 seed 이지 탐색 과정 자체가 아니므로 결정론일 필요가 없다고 판단.
