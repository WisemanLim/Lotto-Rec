# 결과 — impl 30th: S5.8 최근 당첨번호 2열 그리드 (PRD v1.14.2) — 2026-09-14

## 시도 1 — FAIL (30-2) → 시도 2 — FAIL (30-2) → 시도 3 — PASS 3/3

| 시도 | 내용 |
|---|---|
| 1 | `grid sm:grid-cols-2 2xl:grid-cols-3`(1fr 트랙). 사용자 화면(2xl 폭)에서 3열이 우측 도구와 겹치고 회차 라벨 `1241\n회` 줄바꿈 → 사용자 결정 **2열 고정** |
| 2 | `sm:grid-cols-2`(1fr) + `whitespace-nowrap`. 1280px 스크린샷에서 2열째 보너스 공이 '대상 회차' 라벨과 겹침 — 1fr 트랙 최소폭이 내용보다 작아 overflow |
| 3 | `sm:grid-cols-[repeat(2,max-content)]` + `gap-x-4` + 라벨 `w-11 shrink-0` + 우측 도구 `shrink-0` + 헤더 좌측 그룹 `flex-1 gap-3`(min-w-0 제거 → 공간 부족 시 겹침 대신 줄바꿈) |

| id | 판정 | 근거 |
|---|---|---|
| 30-1 | PASS | vitest: `ul.className` 에 `grid`·`sm:grid-cols-[repeat(2,max-content)]`, `grid-cols-3` 없음, li `whitespace-nowrap` |
| 30-2 | PASS | `logs/my-numbers-1280.png`·`-1440.png`·`-1600.png`: 5회차가 2열(3+2), 라벨 한 줄, 우측 도구(대상 회차/시도 버튼) 세로 2줄과 겹침 없음 |
| 30-3 | PASS | `make test` pytest 76 · vitest 46 (`logs/make-test.log`), eslint 0 |

## 변경 파일
`frontend/src/pages/MyNumbers.tsx`, `frontend/src/components/States.tsx`, `frontend/src/pages/MyNumbers.recent.test.tsx`, `.docs/PRD.md`(v1.14.2), README(한/영)
