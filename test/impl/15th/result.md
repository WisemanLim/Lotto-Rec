# 시험 결과 / Test Result — impl 15th (S4.10 내 번호로 자동 등록, PRD v1.6)
- 일자: 2026-09-09 / 대상: custom(python-fastapi + react) / 커밋: 70d386b 기준 작업 트리
## 요약
- 전체 5, 통과 5, 실패 0 (1건 수정 후 재시험) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 15-1 | PASS | `test_auto_register.py` — rounds = target(1001), counts 합 = 5,005, selected 5개·1..10·오름차순, 빈도 상위 5(동률 작은 번호) 일치 |
| 15-2 | PASS | frequency_hot·uniform 최신 batch 각 10장, registered 위치 = selected, missing 없음, 사용자 티켓 수 +total_registered, label `추천 …`·target 승계 |
| 15-3 | PASS | seed 42 재호출 → 동일 selected, total_registered 0·skipped = 이전 등록 수, 티켓 수 불변. seed 미지정 → 응답 seed(int) 포함 |
| 15-4 | PASS | `Recommend.history.test.tsx` — 필터 그룹 내 버튼 순서(필터 초기화 → 내 번호로 자동 등록), confirm 후 POST body `{}`(대상 회차 미선택), role=status 요약에 `대상 1241회`·`2, 4, 5, 7, 9`·`등록 1장` |
| 15-5 | PASS | round 2: `make test` pytest 62/62 + vitest 31/31, `make lint` ruff/mypy/eslint/tsc 클린, OpenAPI 스냅샷 43 갱신 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | `make lint` mypy: `Unsupported operand types for % ("Sequence[int]" and "int")` (recommend_service.py:221) | `np.random.SeedSequence().entropy` 타입이 `int \| Sequence[int] \| None` | `secrets.randbits(31)` 로 seed 생성 | round 2 PASS (logs/make-lint-round2.log) |
## 가정(기본값)
- P(위치 풀) = `LOTTO_NUMBER_RECOMMENDATION_COUNT`(기본 10 = 요청의 "1~10"), 5개 무작위 비복원 추출, 반복 횟수 = 대상 회차 번호.
- 대상 회차 = 이력 필터 '대상 회차' 선택값, 미선택 시 최신 회차+1. 대상 = origin=user 이력만(검증 replay 제외).
- "각 전략별 티켓" = 대상 회차의 전략별 **최신 batch** 티켓을 rec_id 오름차순 1..n 위치로 매핑. 동일 번호·회차 기존 등록은 건너뜀.
- 실 DB(data/lotto.db) 에는 실행하지 않음(사용자 티켓 쓰기). 격리 테스트 DB 로만 검증.
## 첨부
- logs/make-test.log, logs/make-lint.log(round 1 실패), logs/make-lint-round2.log
