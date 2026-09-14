# 시나리오 — impl 28th: S5.8 저장된 번호 헤더 정렬 + 최근 당첨번호 (PRD v1.14) — 2026-09-14

대상: `frontend/src/pages/MyNumbers.tsx`, `frontend/src/components/States.tsx`(Section `aside`).

| id | 케이스 | 수용 기준 |
|---|---|---|
| 28-1 | 헤더 우측 도구 세로 정렬 | '대상 회차' select(1줄) → '등록된 번호로 추첨 시도' 버튼(2줄), `flex-col items-end` 컨테이너 안에 순서대로 2자식 |
| 28-2 | 최근 당첨번호 표시 | 타이틀 '저장된 번호 (대상 R+1회)' 바로 우측(같은 부모)에 list(`최근 당첨번호 5회차`) 5행, 행 = `회차 · 6공 + 보너스` |
| 28-3 | 요청 | `GET /api/v1/data/draws?limit=5&order=desc` 1회, 회차 필터와 무관 |
| 28-4 | 실 백엔드 확인 | 로컬 API `/api/v1/data/draws?limit=5&order=desc` → 최신 5회차(1241…1237) 반환 |
| 28-5 | 회귀 | S5.5 추첨 시도 테스트(`MyNumbers.lottery.test.tsx`) 계속 PASS, tsc·eslint 0 오류 |
| 28-6 | 전체 회귀 | `make test` pytest·vitest 전체 PASS |
