# 시험 결과 / Test Result — impl 5th (S4.6 추천 이력 필터·전체 조회, S4.7 추천 → 내 번호 등록)
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 10, 통과 10, 실패 0 (frontend 3회 수정 후 재시험) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 5-1~5-4 | PASS | test_recommend_history.py (필터·offset·summary·422) 1 passed; 라이브: summary total 20, hybrid 10행, limit 20000 → 422 |
| 5-5 | PASS | 라이브 텍스트: "필터 20 / 전체 20장", 전략(건수 병기)·대상 회차·batch·표시 개수(20/50/100/전체)·필터 초기화 |
| 5-6 | PASS | Recommend.history.test — history 요청 `limit=20` 확인 |
| 5-7 | PASS | RegisterMyNumber 컴포넌트를 TicketCard 에 삽입 (strategy·target_draw_no 승계) |
| 5-8 | PASS | 이력 행 "내 번호" 열 — vitest: confirm → POST /user/tickets {numbers, target_draw_no 1241, label "추천 … #1"} → "내 번호 #77 등록됨" |
| 5-9 | PASS | tsc 0 · eslint 0 · vitest 16/16 · build OK · pytest 42/42 · ruff/mypy 클린 |
| 5-10 | PASS | shot-recommend-v06.png, 콘솔 오류 0, 20행 모두 "내 번호로 등록" 버튼 렌더 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | tsc: `RecommendHistoryParams` index signature 없음 | `get()` 의 QueryParams 제약 | `extends QueryParams` | PASS |
| 1 | vitest: `RunProvider 밖에서 useRun 호출` | 테스트 래퍼 누락 | RunProvider 로 감싸고 기본 fake fetch 는 `[]` 반환 | PASS |
| 2 | tsc: `rec_id: number \| string \| null` 불일치 | RecommendTicket.rec_id 타입 | RegisterMyNumber.recId 를 `number \| string \| null \| undefined` 로 | PASS |
## 첨부
- logs/pytest.log, logs/vitest.log, logs/shot-recommend-v06.png
