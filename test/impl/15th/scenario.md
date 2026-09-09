# 시나리오 — impl 15th: S4.10 내 번호로 자동 등록 (PRD v1.6)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 15-1 | 선택 규칙 | POST /recommend/auto-register {seed:42}, 이력: frequency_hot+uniform 10장 | rounds = target_draw_no, counts 합 = rounds×5, selected = 빈도 상위 5(동률 작은 번호) 오름차순, 1..10 | P0 |
| 15-2 | 전략별 등록 | 동일 | 전략별 최신 batch, 위치 1..n 매핑, registered 위치 = selected, `POST /user/tickets` 규칙(label `추천 <전략> #rec_id`, target) 로 저장, 사용자 티켓 수 증가 = total_registered | P0 |
| 15-3 | 중복 방지·재현성 | 같은 seed 재호출 / seed 미지정 | 같은 selected, 전부 skipped_existing, 티켓 수 불변 / 응답에 seed 포함 | P0 |
| 15-4 | UI | 추천 이력 필터 바 | '내 번호로 자동 등록' 버튼이 '필터 초기화' 바로 우측, confirm 후 POST(대상 회차 필터 승계), 결과 요약(role=status: 대상 회차·선택 위치·등록/중복 건수·전략별 티켓) | P0 |
| 15-5 | 게이트 | 전체 | make test(pytest+vitest) · make lint 통과, OpenAPI 스냅샷 43 갱신(의도적 추가) | P0 |
