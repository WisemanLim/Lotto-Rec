# 시나리오 — impl 34th: 추천 정합성 분석 (PRD v1.16, S8.7~S8.9)

| id | 기대 |
|---|---|
| 34-1 | 균등 무작위 티켓·추첨(120회×10장): 판정 consistent, 편차 0, 다음 실험 제안 없음 |
| 34-2 | 당첨번호 누설 티켓: 번호 상관·번호쌍 초과 유의, 판정 deviation, next_experiment 생성 |
| 34-3 | control(uniform) 편차는 전략이 아닌 데이터·평가 점검 안내, 실험 제안 없음 |
| 34-4 | 회차 5개 미만은 insufficient, 검정 0, '판정 보류' 문구 |
| 34-5 | `GET /tracking/consistency` 가 outcome 에서 계산, origin 필터·422 검증 |
| 34-6 | UI: 성과 추적에 표·판정·다음 실험 제안 렌더 |
| 34-7 | 실데이터(라이브 DB) 스모크: backtest 8전략×240회 |
| 34-8 | 회귀: pytest·vitest·mypy·OpenAPI 스냅샷 |
