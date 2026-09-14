# 시나리오 — impl 26th: 추천 생성 버튼 두 줄 표시 (PRD v1.12.1, 사용자 보고 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 26-1 | 원인 | 추천 생성 폼(lg 6열, 버튼 슬롯 1열, `flex-wrap`) | 슬롯 폭 < 두 버튼 폭 → 줄바꿈 | P0 |
| 26-2 | 수정 | 폼 lg 7열, 버튼 슬롯 `sm:col-span-2`, `flex-nowrap whitespace-nowrap` | 두 버튼 한 줄, 체크박스 열은 그대로 | P0 |
| 26-3 | 게이트 | vitest(같은 부모·nowrap 단언)·eslint·tsc | PASS | P0 |
