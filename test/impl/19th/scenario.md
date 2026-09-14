# 시나리오 — impl 19th: 내 번호 보너스 포함 평가 백색 화면 수정 (PRD v1.9.1, 사용자 보고 2026-09-14)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 19-1 | 재현·원인 | `POST /user/tickets/evaluate` {numbers, bonus:7} | 응답 200 이지만 `bonus` 가 dict → `BallRow bonus={obj}` 렌더 크래시(백색 화면) | P0 |
| 19-2 | API 계약 | 동일 요청 | `bonus`=7(int), `bonus_info`={in_main:false, observed_as_main:int}; 보너스 없으면 둘 다 null | P0 |
| 19-3 | UI 렌더 | ScorecardView sc.bonus=7 + bonus_info | 크래시 없이 보너스 공(aria-label '보너스 7')·"본번호로 출현 n회" 표시; bonus 가 객체여도 크래시 없음 | P0 |
| 19-4 | 게이트 | 전체 | pytest/vitest/lint/build 통과, OpenAPI 경로 스냅샷 불변 | P0 |
