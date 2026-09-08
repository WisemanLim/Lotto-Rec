# 시나리오 — impl 5th: S4.6 추천 이력 필터·전체 조회 + S4.7 추천 → 내 번호 등록 (PRD v0.6)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 5-1 | 이력 API 필터 | strategy / batch_id / target_draw_no | 조건 일치 행만, summary.total_filtered 일치 | P0 |
| 5-2 | offset 페이징 | limit=5 반복 | 전체 집합 동일·중복 없음·내림차순 | P0 |
| 5-3 | 요약 엔드포인트 | /recommend/history/summary | total_all·by_strategy·target_draws(내림차순)·batches | P0 |
| 5-4 | limit 상한 | limit=20000 | 422 | P1 |
| 5-5 | 필터 바 UI | 추천 화면 | 전략·대상회차·batch·표시개수(20/50/100/전체) 셀렉트, 건수 요약 "필터 n / 전체 m장", 초기화 | P0 |
| 5-6 | 표시 개수 전달 | 기본 진입 | history 요청에 limit=20, 전체 선택 시 10000 | P0 |
| 5-7 | 카드 → 내 번호 등록 | 추천 결과 카드 버튼 | confirm 후 POST /user/tickets {numbers, label "추천 <전략> #rec_id", target_draw_no}, 성공 시 "내 번호 #id 등록됨 · 보기" 링크 | P0 |
| 5-8 | 이력 → 내 번호 등록 | 이력 행 버튼 | 동일 동작 (재진입 후에도 가능) | P0 |
| 5-9 | 품질 게이트 | tsc/eslint/vitest/build, pytest/ruff/mypy | 모두 통과 | P0 |
| 5-10 | 라이브 확인 | /recommend 스크린샷 | 필터 바·등록 버튼 렌더, 콘솔 오류 0 | P1 |
