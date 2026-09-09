# 시험 결과 / Test Result — impl 14th (S4.9 과거 1·2등 회차 표시, PRD v1.5)
- 일자: 2026-09-09 / 대상: custom(python-fastapi + react) / 커밋: 70d386b 기준 작업 트리
## 요약
- 전체 5, 통과 5, 실패 0 → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 14-1 | PASS | `test_past_wins.py::test_index_first_second_and_none` — 386회(4·7·10·19·31·40 +26) 역순 입력 → rank 1, 5개+보너스 → rank 2, 5개+비보너스 → 386 미포함, 회차 오름차순 |
| 14-2 | PASS | `test_past_wins_in_recommend_history_and_outcomes` — POST /recommend 티켓, GET /recommend/history 행, GET /tracking/outcomes 행 모두 `past_wins` list |
| 14-3 | PASS | `LottoBall.test.tsx` PastWinTags — `(386)`·`(712)` 렌더, `text-[10px] text-neutral-400/80`(dark: neutral-500), 툴팁 `386회 1등 조합과 일치`, 빈 배열 미렌더. 적용 위치: 추천 카드(`TicketCard`)·추천 이력 표·성과 추적 결과 표 '티켓' 열 |
| 14-4 | PASS | 실 DB 19,220 이력 중 31장 일치(예: rec 17327 pair_association [8,15,17,19,43,44] → 855회 1등; 18529 → 463회 2등). 인덱스 생성 11.9ms/요청(캐시 불필요). `logs/realdb-check.log` |
| 14-5 | PASS | `make test`: pytest 61/61 + vitest 30/30 · `make lint`: ruff/mypy/eslint/tsc 클린 · OpenAPI 경로 스냅샷 42 불변(필드만 추가) |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| — | 없음 | — | — | — |
## 가정(기본값)
- 1등 = 본번호 6개 동일, 2등 = 본번호 5개 + 그 회차 보너스(3등 이하 미표시 — 요청 범위).
- 성과 추적 표의 '티켓' 열도 동일 표시(추천 티켓이 함께 표시되는 열). 복수 회차는 공백 나열, 툴팁에 등수.
## 첨부
- logs/make-test.log, logs/make-lint.log, logs/realdb-check.log
