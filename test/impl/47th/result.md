# 결과 — impl 47th: 제외 번호를 추천 생성에도 적용 + 추천 개수 200 상한 (PRD v1.29 S4.14) — 2026-09-27

## 시도 1 — PASS 8/8

| id | 판정 | 근거 |
|---|---|---|
| 47-1 | PASS | `Recommend.exclude.test.tsx` 1번째 시험(같은 카드 그리드 컨테이너 안, 마지막 카드 뒤). 라이브 캡처 `logs/strategy-exclude.png` |
| 47-2 | PASS | 2번째 신규 시험: 9 선택 → `POST /recommend` body `{exclude_numbers:[9]}` |
| 47-3 | PASS | 3번째 신규 시험: 23 선택 → `POST /recommend/sequential` body `{exclude_numbers:[23]}` |
| 47-4 | PASS | `test_recommend_exclude.py`: uniform/frequency_hot/frequency_cold/bayesian_shrink/pair_association/analysis_weighted 6개 파라미터화 시험 + low_competition·hybrid 폴백 + pattern_typical, 전부 제외 번호 미포함 확인 |
| 47-5 | PASS | `test_heavy_exclusion_degrades_gracefully_with_warning`: 1~39 제외(6개만 남음) → 크래시 없음, 반환된 티켓 있으면 제외 준수, 부족하면 `meta.warning` 에 '제외 번호' 포함 |
| 47-6 | PASS | `test_recommend_exclude_numbers_out_of_range_422`(양쪽 엔드포인트) |
| 47-7 | PASS | `test_recommend_count_allows_up_to_200`(200 통과, 201 거부), 화면 입력 `max=200` 확인 시험, `.env.local.example`·README·PRD 표 갱신 |
| 47-8 | PASS | pytest 119 passed(+13), vitest 94 passed(+3), tsc·eslint·mypy 무오류. `.env.local` sha1 체크섬 실행 전후 동일 |

## 설계 결정
- **거부 표본추출(rejection sampling)**: 가중치를 0 으로 두는 대신(부동소수 언더플로에 의존하는 방식은 통계적으로 완전한 보장이 아님) 생성된 조합이 제외 번호를 포함하면 버리고 다시 뽑는 방식을 택해, 반환된 모든 티켓이 제외 번호를 **절대** 포함하지 않음을 코드로 보장한다. `hybrid`/`low_competition` 의 후보 풀 방식도 동일하게 사전 필터링.
- 제외 번호가 지나치게 많아 유효 조합이 희박해지면(예: 39개 제외) 기존 커버리지 제약과 같은 방식으로 그레이스풀 디그레이드(일부만 생성 + warning)한다 — 개수를 억지로 채우지 않음.
- 추천 개수 상한 200 은 화면 입력·`RecommendIn`/`SequentialIn` 스키마·`recommend()` 서비스 검증·`LOTTO_NUMBER_RECOMMENDATION_COUNT` 설정 상한까지 모두 일관되게 상향.
- 제외 번호 상태는 페이지 전역(하나의 `excludeNumbers`) — '추천 생성'·'추천 생성(순차)'·'내 번호로 자동 등록' 세 액션이 모두 같은 선택을 공유한다.
