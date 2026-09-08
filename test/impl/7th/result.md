# 시험 결과 / Test Result — impl 7th (추천 이력 출처 필터 · "전체인데 20건" 보고 대응)
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 6, 통과 6, 실패 0 (backend 1 버그·상한 1 조정 후 재시험) → 최종 Verdict: **PASS**
## 원인 분석 (7-1)
- 표시 로직 정상. DB: origin=user **20장**(1 batch 06:02:55), origin=backtest **19,200장**(검증 replay). 이력은 설계상 user 만 조회 → 사용자가 본 "전체 20장"은 데이터 그대로. 개선: 출처 필터로 replay 시뮬레이션 티켓도 조회 가능하게.
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 7-1 | PASS | DB/summary API 로 확인 |
| 7-2 | PASS(round 2) | test_history_origin_filter — user/backtest/all, by_origin, 422 |
| 7-3 | PASS | 행 `origin` 필드 |
| 7-4 | PASS | Recommend.history.test — 출처 셀렉트 기본 user, 헤더 "필터 3 / 사용자 생성 40장 · 검증 replay 19,200장 별도", origin=user 파라미터 전달 |
| 7-5 | PASS(round 3) | 라이브: 출처=전체·표시=전체 → "필터 19,220 / 전체 19,220장", 표 200/19,220 행(더 보기), API 2.7MB 0.1s, 콘솔 오류 0 |
| 7-6 | PASS | pytest 51/51 · ruff · mypy / tsc 0 · eslint 0 · vitest 18/18 · build |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | `NameError: by_origin` (500) | ruff 포맷으로 줄바꿈된 블록에 문자열 치환 실패 → 부분 패치 | 함수 전체 재패치(`ocond`, `true()`), 라이브에서 500 2회는 이 시점 잔여 | 51 passed |
| 2 | 출처=전체 선택 시 10,000 행만 표시 | API limit 상한 10,000 < 19,220 | 상한 50,000, 프론트 "전체"=50,000, 표는 200행 단위 "더 보기"(DOM 부담 방지, CSV 는 전체) | 19,220 로드 확인 |
## 첨부
- logs/pytest.log, logs/vitest.log, logs/shot-history-all.png
