# 결과 — impl 23rd: S5.7 저장된 번호 회차 전환·회차 필터 (PRD v1.11) — 2026-09-14

## 시도 1 — 5/6 (23-6 실패) → 시도 2 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 23-1 | PASS | `test_active_draw_switches_only_after_next_recommendation_saved` 전반부 |
| 23-2 | PASS | 같은 테스트: save=false 추천 후 active=R |
| 23-3 | PASS | 같은 테스트: save=true 후 active=R+1, 필터 R+1 → [] / R → 1건 / 전체 1건 |
| 23-4 | PASS | `test_active_draw_next_registered_without_recommendation` |
| 23-5 | PASS | `MyNumbers.draws.test.tsx` 2건. 기존 `MyNumbers.dup/lottery` 테스트는 `/user/tickets` prefix mock 이 `/user/tickets/draws` 도 가로채 크래시 → mock 에 draws 응답 추가 |
| 23-6 | 시도 1 FAIL → 시도 2 PASS | 시도 1: 단독 실행은 통과했으나 전체 실행에서 다른 테스트가 회차를 1005 까지 삽입해 하드코딩 1000/1001 단언 실패 → `next_draw`/`latest_result_draw` 를 응답에서 읽어 상대 규칙으로 단언. 시도 2: pytest 74/74 · vitest 42/42 · ruff/mypy/eslint/tsc clean · 스냅샷 44 경로 |

라이브: `GET /api/v1/user/tickets/draws` → next 1242 · latest 1241 · active 1242 · reason next_registered (실 DB 에 1242 대상 내 번호 존재).

## 변경 파일
- backend `api/user.py`(`GET /tickets/draws`, `GET /tickets?target_draw_no=`), test `test_user_ticket_draws.py`(신규), `openapi_paths.snapshot.json`(+1)
- frontend `pages/MyNumbers.tsx`(회차 필터·안내·빈 목록 문구·추첨 풀 = 표시 목록), `pages/Recommend.tsx`(추천 저장 시 `['user']` 무효화), `api/client.ts`(`TicketDraws`, `ticketDraws`, `tickets(limit, target)`), `lib/glossary.ts`(`active_target_draw`), 테스트 3 파일
- docs `.docs/PRD.md` v1.11(S5.7·E6 표·§11·변경 이력), `README.md`/`README.en.md`

## 가정(기본값)
- 전환 트리거 = 다음 회차(R+1) 대상 **저장된 추천(origin=user)** 또는 **R+1 대상 내 번호 등록**. 저장하지 않은 추천 생성은 트리거 아님(사용자 요구 "저장시에만").
- 전환 전 기본 표시 회차 = 저장된 내 번호 중 가장 최근 대상 회차(보통 R). 내 번호가 하나도 없으면 R+1.
- 이전 회차 번호는 DB 에서 삭제하지 않음(요구사항 "삭제가 아닌"). 회차 필터 옵션: 자동(현재 대상) / 회차별(건수·결과 확정 표시) / 전체.
