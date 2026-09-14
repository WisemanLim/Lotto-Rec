# 시나리오 — impl 22nd: 용어 툴팁 내용이 박스를 벗어남 (PRD v1.10.1, 사용자 보고 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 22-1 | 재현·원인 | 표 헤더(`th.whitespace-nowrap`) 안 `Term icon` 툴팁 열기 (스크린샷: p (?) → p-value) | 텍스트가 한 줄로 박스 우측 밖으로 흘러나감. 원인: 툴팁 `<span>` 이 상위 th 의 `white-space: nowrap` 상속 → 줄바꿈 없음 → 세로 크기도 늘지 않음 | P0 |
| 22-2 | 수정 | `Term` 툴팁 클래스 | `whitespace-normal break-words tracking-normal` 강제, 폭 `w-80` + `max-w-[calc(100vw-2rem)]`, 높이 auto → 긴 내용 개행·박스 세로 확장 | P0 |
| 22-3 | 게이트 | `Term.test.tsx` 회귀 + 전체 | vitest 40/40, eslint/tsc 통과 | P0 |
