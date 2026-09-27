# 시나리오 — impl 47th: 제외 번호를 추천 생성에도 적용 + 추천 개수 200 상한 (PRD v1.29, S4.14)

| id | 기대 |
|---|---|
| 47-1 | 제외 번호 그리드가 '전략 선택' 카드 그리드의 '군 A 분석 가중' 카드 우측 빈 공간에 배치(lg:col-span-3) |
| 47-2 | 선택한 제외 번호가 '추천 생성' 요청(`POST /recommend`)의 `exclude_numbers` 로 전달됨 |
| 47-3 | 선택한 제외 번호가 '추천 생성(순차)' 요청(`POST /recommend/sequential`)의 `exclude_numbers` 로 전달됨 |
| 47-4 | 백엔드: 생성된 모든 조합이 제외 번호를 포함하지 않음(거부 표본추출) — 일반 전략·low_competition/hybrid 폴백·pattern_typical 모두 |
| 47-5 | 백엔드: 제외 번호가 과도해 유효 조합을 찾기 어려우면 크래시 없이 일부만 생성 + warning |
| 47-6 | 백엔드: 1~45 범위 밖 값은 422(양쪽 엔드포인트) |
| 47-7 | 추천 개수 상한이 50 → 200 으로 상향(화면 입력·API·`.env` 설정 모두) |
| 47-8 | 회귀: pytest·vitest·tsc·eslint·mypy, `.env.local` 무변경, 라이브 화면 |
