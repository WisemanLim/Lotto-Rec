# 시나리오 — impl 39th: 추첨 개수 .env 관리·입력 박스, 안내 문구 배열 (PRD v1.21)

| id | 기대 |
|---|---|
| 39-1 | `LOTTO_LOTTERY_PICK_COUNT`(기본 5, 1–50) → `/config` `lotto_lottery_pick_count`, `.env.local.example`·설정 화면 설명 |
| 39-2 | '등록된 번호로 추첨 시도' 앞에 개수 입력 박스, 초깃값 = .env 값(없으면 5), 수정 시 그 개수만큼 ★ |
| 39-3 | 개수 > 티켓 수이면 min(k, N), 비어 있음·0·51·소수는 버튼 비활성 |
| 39-4 | 추첨 시도 결과 문구를 '★ 번호 테두리 = 최근 6회차 …' 범례 우측 같은 줄에 배치 |
| 39-5 | 회귀: pytest·vitest·tsc·eslint·mypy, 라이브 화면 |
