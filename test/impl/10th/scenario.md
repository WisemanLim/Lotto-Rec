# 시나리오 — impl 10th: 성과 추적 티켓 단위 결과 필터 (S8.6, PRD v1.1)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 10-1 | outcomes 필터·페이징 | draw_no/strategy/source/origin/limit/offset | 조건 일치, offset 페이지 합 = 전체·중복 없음, limit>50000 → 422 | P0 |
| 10-2 | summary | /tracking/outcomes/summary?필터 | total_filtered·total_all·draw_nos(내림차순)·strategies·by_source·by_origin | P0 |
| 10-3 | UI 필터 바 | 성과 추적 화면 | 회차·전략·출처(추천/내 번호)·표시 개수(20~전체) 셀렉트 + 초기화, 헤더 "필터 n / 전체 m건", origin 토글과 연동 | P0 |
| 10-4 | 전체 표시 | 표시 개수=전체 | 서버 limit 50000, 표 200행 단위 "더 보기", CSV 전체 | P0 |
| 10-5 | 게이트·라이브 | 전체 | pytest/vitest/lint/build 통과, 콘솔 오류 0 | P0 |
