# 결과 — impl 28th: S5.8 저장된 번호 헤더 정렬 + 최근 당첨번호 (PRD v1.14) — 2026-09-14

## 시도 1 — PASS 6/6 (수정 0)

| id | 판정 | 근거 |
|---|---|---|
| 28-1 | PASS | `MyNumbers.recent.test.tsx`: 도구 컨테이너 `flex-col items-end`, 자식 2개 = [label(select '대상 회차 필터'), button '등록된 번호로 추첨 시도'] 순서. 스크린샷 `logs/my-numbers.png` 우측 상단 2줄 확인 |
| 28-2 | PASS | list `최근 당첨번호 5회차` 5행, 1행 `1241회` 공 7개(6+보너스), h2 와 같은 부모(Section `aside` 슬롯). 스크린샷: 타이틀 우측 1241~1237회 공 표시 |
| 28-3 | PASS | fetch 호출 1회 `…/data/draws?limit=5&order=desc` |
| 28-4 | PASS | `curl :8000/api/v1/data/draws?limit=5&order=desc` → 1241 [7,13,16,23,24,43]+9 … 1237 [10,20,23,34,37,40]+36 (화면과 일치) |
| 28-5 | PASS | `MyNumbers.lottery.test.tsx` PASS, `tsc --noEmit` 0, `eslint .` 0 |
| 28-6 | PASS | `make test` pytest 76/76 · vitest 46/46 (19 files) — `logs/make-test.log` |

## 변경 파일
- `frontend/src/components/States.tsx` — `Section` 에 `aside?: ReactNode`(타이틀 우측 슬롯), 헤더 `items-start`
- `frontend/src/pages/MyNumbers.tsx` — `RECENT_DRAWS=5`, `api.data.draws({limit:5, order:'desc'})` 쿼리, `aside` 최근 당첨번호 목록, `right` 를 `flex-col items-end` 로 세로 정렬
- `frontend/src/pages/MyNumbers.recent.test.tsx` — 신규
- `.docs/PRD.md` v1.14 (S5.8, §6 E6 표, §16.4)

## 가정
- 최근 회차 수 5 는 프론트 상수(`RECENT_DRAWS`), env 미노출. 회차 필터 값과 무관하게 항상 DB 최신 5회차.
