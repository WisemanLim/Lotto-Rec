# 시나리오 — impl 23rd: S5.7 저장된 번호 회차 전환·회차 필터 (PRD v1.11, 사용자 요청 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 23-1 | 결과 등록 직후 유지 | 결과 회차 R 대상 내 번호 1건, 다음 회차 추천 없음 → `GET /user/tickets/draws` | active=R, reason=awaiting_next_recommendation, draws=[{R,1,evaluated:true}] — 낙첨 등 결과 확인 가능 | P0 |
| 23-2 | 저장 없는 추천은 전환 안 함 | `POST /recommend save=false` (target R+1) | active 여전히 R | P0 |
| 23-3 | 다음 회차 추천 저장 → 전환 | `POST /recommend save=true` | active=R+1, reason=next_recommended; `GET /user/tickets?target_draw_no=R+1` = [] (삭제 아님), `?target_draw_no=R` 1건, 전체 1건 | P0 |
| 23-4 | 다음 회차 직접 등록 → 전환 | 내 번호 target=R+1 등록 | active=R+1, reason=next_registered, draws 내림차순·evaluated 플래그 | P0 |
| 23-5 | 프론트 | `/my-numbers` mock: next_recommended / awaiting | 기본 목록은 현재 대상 회차만(1243회 빈 목록+안내, 1242 번호 숨김) → 필터 1242 선택 시 낙첨 결과 표시; awaiting 이면 1242 번호·결과 그대로 + 전환 안내 | P0 |
| 23-6 | 게이트 | 전체 | pytest/vitest/ruff/mypy/eslint/tsc, OpenAPI 스냅샷 44 경로(`GET /user/tickets/draws` 추가) | P0 |
