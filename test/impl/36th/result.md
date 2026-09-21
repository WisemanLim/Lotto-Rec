# 결과 — impl 36th: 결과 입력 옆 과거 6회차 요약 (PRD v1.18 S1.7) — 2026-09-21

## 시도 1 — PASS 5/5

| id | 판정 | 근거 |
|---|---|---|
| 36-1 | PASS | `RecentDrawChips.test.tsx`, `Tracking.entry.test.tsx`(제목 뒤·폼 내부), 라이브 캡처 `logs/settings.png` 에 1242~1237 칩 |
| 36-2 | PASS | 테스트에서 요청 URL 에 limit=6·order=desc 확인, 라이브 API 응답 [1242…1237] |
| 36-3 | PASS | 툴팁 표 구조 테스트(role=tooltip, 순위·총액·게임 수·1게임당·기준). 마우스 오버 시각 확인은 헤드리스 캡처로 불가해 미수행(CSS group-hover/focus-within) |
| 36-4 | PASS | 1242 목업: 29,529,263,250 / 4,921,543,952 / 4,921,546,630 / 8,268,850,000 / 13,645,725,000 원, 값 없는 회차 '—' |
| 36-5 | PASS | vitest 59 passed, tsc·eslint 무오류. 백엔드 변경 없음 |
