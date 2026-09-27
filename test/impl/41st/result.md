# 결과 — impl 41st: 추천 생성 폼 레이아웃 압축 (PRD v1.23) — 2026-09-27

## 시도 1 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 41-1 | PASS | 그리드(9열 고정 트랙) → `flex flex-wrap gap-x-2` 로 전환 + 추천개수·티켓공유 입력폭 `!w-16`, seed `!w-28`, 희망등수 셀렉트 `!w-40`. 라이브 캡처 `logs/recommend-form.png` 에서 입력란 간 간격이 촘촘함을 확인 |
| 41-2 | PASS | 체크박스 라벨에 `whitespace-nowrap` 추가, `Recommend.seedsearch.test.tsx` 신규 레이아웃 시험, 라이브 캡처 한 줄 확인 |
| 41-3 | PASS | 동일 |
| 41-4 | PASS | flex-wrap 전환으로 버튼 FormSlot 이 콘텐츠 폭만 차지(이전엔 `sm:col-span-2` 그리드 트랙이 남는 폭을 강제로 차지) — 캡처에서 버튼 뒤 여백 소거 확인 |
| 41-5 | PASS | 40th 시나리오의 필드 순서·SEED 시작/폴링/중지 시험 7건 그대로 통과 |
| 41-6 | PASS | vitest 77 passed, tsc·eslint 무오류. 백엔드 파일 변경 없어 pytest 재실행 생략(직전 40th 에서 97 passed 확인) |

## 변경 파일
`frontend/src/components/States.tsx`(`Field` 에 선택적 `className` prop 추가 — 하위호환), `frontend/src/pages/Recommend.tsx`(폼 컨테이너 grid→flex-wrap, 입력 폭 축소, 체크박스 라벨 nowrap), `frontend/src/pages/Recommend.seedsearch.test.tsx`(레이아웃 회귀 시험 추가).
