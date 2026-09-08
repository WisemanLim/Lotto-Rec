# 시험 결과 / Test Result — impl 9th (공통 UX: 폼 정렬 · 표시명 · 테마 메뉴) — PRD v1.0
- 일자: 2026-09-08 / 대상: custom(react SPA) / 커밋: (git 미초기화)
## 요약
- 전체 6, 통과 6, 실패 0 (라이브 검증 round 2: dev 서버 재시작 필요) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 9-1 | PASS | Field 3줄 고정(라벨 h-4, 입력, 힌트 min-h 14px 예약). 라이브 실측: 설정 "분석 실행" 폼 입력 top = 1306/1306/1306/1306/1306/1307(버튼) · 추천 이력 필터 6개 모두 961 · 추천 폼 입력 674 (이전: 힌트 유무로 어긋남) |
| 9-2 | PASS | FormSlot 로 버튼·체크박스 오프셋(라벨 높이) — 설정·추천·추천 이력·내 번호 폼 적용, `items-end` 잔존 0 |
| 9-3 | PASS | 사이드바/모바일 헤더 "Lotto number" / "recommender" 2줄, `<title>`, backend app_name·APP_NAME env, App.test 갱신 |
| 9-4 | PASS(round 2) | ThemeProvider(light/dark/system)·ThemeMenu 플로팅(우상단 fixed z-50). 라이브: 다크 선택 → html.dark=true, localStorage=dark, 배경 rgb(10,10,10)/사이드바 rgb(23,23,23), 새로고침 후 유지. round 1: tailwind `darkMode:'class'` 변경이 실행 중 dev 서버에 반영되지 않아 시각 변화 없음 → `make local-restart` 후 정상 |
| 9-5 | PASS | aria-haspopup/menu/menuitemradio/aria-checked, ESC·바깥 클릭 닫힘 (ThemeMenu.test) |
| 9-6 | PASS | tsc 0 · eslint 0 · vitest 21/21 (신규 3: 테마 토글/저장, 초기 적용, Field 3줄) · build OK · 콘솔 오류 0 · 스크린샷 logs/shot-light.png, shot-dark.png |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | 다크 선택 후 html.dark=true 인데 화면은 라이트 | Tailwind JIT 가 config(darkMode) 를 시작 시점에 로드 — 변경 미반영 | dev 서버 재시작(`make local-restart`); 트러블슈팅에 기록 | 배경 rgb(10,10,10) 확인 |
## 첨부
- logs/vitest.log, logs/shot-light.png, logs/shot-dark.png
