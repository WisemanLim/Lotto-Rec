# 시나리오 — impl 18th: 내 번호 중복 등록 ★ 표시 (S5.6, PRD v1.9)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 18-1 | 같은 회차 중복 저장 | 동일 6개 번호(순서 무관)를 같은 target 으로 2회 `POST /user/tickets` | 행 1개(ticket_id 동일), dup_count=2, dup_labels 누적, 응답 duplicate=true | P0 |
| 18-2 | 다른 회차 동일 번호 | 같은 번호, target+1 | 새 행 생성, duplicate=true, 양쪽 same_number_ticket_ids 상호 참조 | P0 |
| 18-3 | 목록 응답 | GET /user/tickets | 행마다 dup_count·dup_labels·same_number_ticket_ids·duplicate | P0 |
| 18-4 | 자동 등록 병합 | `POST /recommend/auto-register` 같은 seed 2회 | 2회차는 total_registered=0, total_merged=n, strategies[].merged_duplicates[].dup_count=2, 티켓 수 불변 | P0 |
| 18-5 | UI ★ 배지 | 내 번호 저장 목록 | duplicate 이면 `★ 중복 ×n` 배지(data-testid=dup-badge) + Term 툴팁 `duplicate_ticket`(정직한 해석) | P0 |
| 18-6 | 추천→등록 메시지 | RegisterMyNumber 성공(duplicate) | "★ 중복 — 내 번호 #id 에 병합(×n)" 표시 | P1 |
| 18-7 | 마이그레이션 | `alembic upgrade head` (기존 DB) | user_ticket.dup_count(기본 1)·dup_labels(기본 []) 추가, 멱등 | P0 |
| 18-8 | 게이트 | 전체 | make test(pytest+vitest) · make lint · pnpm build 통과, OpenAPI 경로 스냅샷 불변 | P0 |
