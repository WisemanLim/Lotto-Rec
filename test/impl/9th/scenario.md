# 시나리오 — impl 9th: 공통 UX (폼 정렬 · 표시명 · 테마 메뉴) — PRD v1.0
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 9-1 | Field 3줄 고정 | 힌트 있는/없는 Field 혼합 그리드 | 입력창 상단 y 좌표 동일(설정·추천·검증·성과추적·실험 폼) | P0 |
| 9-2 | 버튼/체크박스 정렬 | 그리드 내 버튼·체크박스 | 입력창과 같은 줄(라벨 높이 오프셋) | P0 |
| 9-3 | 표시명 | 사이드바/모바일 헤더/브라우저 제목 | "Lotto number" / "recommender" 2줄, `<title>` 갱신, App.test 갱신 | P0 |
| 9-4 | 테마 메뉴 | 우측 상단 플로팅 버튼 | light/dark/system 선택, html.dark 토글, localStorage 유지, 새로고침 후 유지, Plotly 테마 연동 | P0 |
| 9-5 | 접근성 | 메뉴 | aria-label·role=menu·aria-checked, 키보드 ESC 닫기 | P1 |
| 9-6 | 게이트·라이브 | tsc/eslint/vitest/build + 스크린샷(light/dark) | 통과, 콘솔 오류 0 | P0 |
