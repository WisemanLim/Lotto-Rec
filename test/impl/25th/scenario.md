# 시나리오 — impl 25th: S4.11 추천 생성(순차) (PRD v1.12, 사용자 요청 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 25-1 | 전 전략 순차 | `POST /recommend/sequential` {count 2, seed 7, save false} | results 순서 = `GET /recommend/strategies` 순서, 전략별 set 1개·control 없음, 전략별 batch_id 상이, total_tickets = 2×전략 수, rec_id null(미저장) | P0 |
| 25-2 | 저장·실패 계속 | {strategies [uniform, nope, frequency_hot], count 3, save true} | results 2, failed [{nope, 알 수 없는 전략}], 이력 +6, batch 별 history 조회 3건 | P0 |
| 25-3 | UI 배치·호출 | `/recommend` 추천 생성 폼 | '추천 생성(순차)' 버튼이 '추천 생성' 우측 같은 슬롯; 클릭 시 sequential 호출(body 에 strategy/include_control 없음, 폼의 count/seed/save 전달) | P0 |
| 25-4 | UI 결과 | mock 2전략 + 실패 1 | 요약(2전략·4장·대상 1242회·실패 1) + '순차 1/2 · …', '순차 2/2 · …' 결과 섹션 | P0 |
| 25-5 | 게이트·라이브 | 전체 | pytest/vitest/ruff/mypy/eslint/tsc, OpenAPI 스냅샷 45 경로, 라이브 sequential(save=false) 9전략 성공 | P0 |
