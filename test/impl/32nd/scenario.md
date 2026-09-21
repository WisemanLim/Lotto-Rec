# 시나리오 — impl 32nd: 현재 회차 초기화 (PRD v1.15, S4.12 · S5.9)

| id | 기대 |
|---|---|
| 32-1 | `DELETE /recommend/history` 는 최신+1 회차의 origin=user 추천만 삭제, backtest·다른 회차 유지, 재호출 0건 |
| 32-2 | 추천 삭제 시 연관 `ticket_outcome`(source=recommendation) 동반 삭제 |
| 32-3 | `DELETE /user/tickets?target_draw_no=` 는 해당 회차만 삭제, 파라미터 누락 422 |
| 32-4 | UI: '추천 초기화'는 '내 번호로 자동 등록' 우측, 확인 취소 시 호출 없음 |
| 32-5 | UI: '내 번호 초기화'는 표시 중 대상 회차로 호출, '전체 회차'에서 비활성 |
| 32-6 | UI 레이아웃: 필터 초기화·자동 등록·추천 초기화 한 줄 / 추첨 시도·내 번호 초기화 한 줄 |
| 32-7 | 회귀: OpenAPI 스냅샷 갱신, 전체 pytest·vitest, mypy |
