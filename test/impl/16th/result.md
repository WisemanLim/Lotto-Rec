# 시험 결과 / Test Result — impl 16th (S4.7/S4.10 UX: 툴팁·즉시 등록, PRD v1.7)
- 일자: 2026-09-09 / 대상: custom(react SPA) / 커밋: 70d386b 기준 작업 트리
## 요약
- 전체 4, 통과 4, 실패 0 → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 16-1 | PASS | `Recommend.history.test.tsx` — 버튼 `title` 이 `1..P 중 5개 무작위 추출…` 와 일치, 필터 그룹 textContent 에 `빈도 상위 5 위치의 전략별 최신 티켓 등록` 없음(FormSlot hint 제거) |
| 16-2 | PASS | confirm 스텁을 `() => false` 로 두고도 POST 1회 발생 → `confirm` 미호출 확인(`not.toHaveBeenCalled`), `내 번호 #77 등록됨` 표시 |
| 16-3 | PASS | `RegisterMyNumber` `confirm` prop 기본 true, 카드(`TicketCard`) 호출부 미변경 — 이력 열만 `confirm={false}` |
| 16-4 | PASS | `make test` pytest 62/62 + vitest 31/31 · `make lint` 클린 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| — | 없음 | — | — | — |
## 첨부
- logs/make-test.log, logs/make-lint.log
