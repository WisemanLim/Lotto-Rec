# 시나리오 — impl 7th: 사용자 보고 "표시 개수 전체인데 20건" (S4.6 출처 필터, PRD v0.8)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 7-1 | 원인 확인 | DB 조회 | origin=user 20장(1 batch), origin=backtest 19,200장 → 표시 오류 아님(데이터) | P0 |
| 7-2 | origin 파라미터 | history/summary ?origin=user\|backtest\|all | 기본 user, backtest 만, all = 합계; by_origin 제공; 잘못된 값 422 | P0 |
| 7-3 | 행 출처 | history 응답 | 각 행 origin 필드 | P0 |
| 7-4 | UI 출처 셀렉트 | 추천 이력 필터 바 | 사용자 생성(n)/검증 replay(n)/전체, 헤더 "필터 n / 사용자 생성 m장 · 검증 replay k장 별도", 출처 열 배지, 초기화 시 user | P0 |
| 7-5 | 라이브 | origin=all 선택 후 전체 표시 | 19,220행 요청·렌더(콘솔 오류 0) | P1 |
| 7-6 | 게이트 | 백/프론트 전체 | 통과 | P0 |
