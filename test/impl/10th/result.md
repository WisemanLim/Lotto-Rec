# 시험 결과 / Test Result — impl 10th (S8.6 성과 추적 티켓 결과 필터) — PRD v1.1
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 5, 통과 5, 실패 0 (프론트 패치 1회 재시도) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 10-1 | PASS | test_tracking_outcomes_filter — draw_no/strategy/origin 필터, offset 7씩 30건 무중복, limit 60000·source=nope → 422 |
| 10-2 | PASS | summary: total 30·draw_nos 내림차순·strategies·by_source·by_origin; 라이브 origin=backtest 19,200건, 회차 목록 1240→ |
| 10-3 | PASS | Tracking.filter.test — 필터 바(role=group)·회차/전략/출처/표시 개수 셀렉트·"필터 7 / 사용자 19,220건"·limit=200&origin=user 전달. 라이브 정렬: 셀렉트 4개+버튼 top 1061/1061/1061/1061/1062 |
| 10-4 | PASS | 표시 개수 전체=50000, DataTable 200행 "더 보기", 잔여 안내 문구 |
| 10-5 | PASS | pytest 55/55(신규 1) · vitest 22/22(신규 1) · ruff/mypy/tsc/eslint 클린 · build OK · 콘솔 오류 0 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | 프론트 패치 스크립트 AssertionError(outcomes fn not found) → 화면 미변경 | 멀티라인 파라미터 객체를 단일 정규식으로 매칭 실패 | 정확한 문자열 치환으로 재패치 | vitest 22 PASS |
## 첨부
- logs/pytest.log, logs/vitest.log, logs/shot-tracking-filter.png
