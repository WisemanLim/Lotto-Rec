# 시험 결과 / Test Result — impl 4th (E6 대시보드)
- 일자: 2026-09-08 / 대상: custom(react SPA) / 커밋: (git 미초기화)
## 요약
- 전체 12, 통과 12, 실패 0 (2건 수정 후 재시험) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 4-1 | PASS | tsc 0, eslint 0, vitest 14/14 (4 files), vite build OK (chunk >500kB 경고 — Plotly, 허용) |
| 4-2 | PASS | shot-overview.png — KPI 8카드·판정 배지·빈도 막대(기대선·PI95)·해석 원칙 배너 |
| 4-3 | PASS | shot-frequency.png |
| 4-4 | PASS | shot-pairs.png — 45×45 z 히트맵, 상위 쌍 표(BH q·판정), 네트워크(탐색 30), 집합/조건부 탐색기, 3-집합 표 |
| 4-5 | PASS | 에이전트 스크린샷(shot-groups) |
| 4-6 | PASS | 에이전트 스크린샷(shot-temporal) |
| 4-7 | PASS | shot-validation.png — 8전략 backtest 표, 누적 곡선, 일치수 히스토그램 vs 하이퍼지오메트릭, 균등 대비 CI, 스코어링, 재현성, 동질성 |
| 4-8 | PASS | shot-recommend.png (+ 에이전트 shot-recommend-result/scorecard) |
| 4-9 | PASS | 에이전트 shot-my-numbers(-eval) |
| 4-10 | PASS | shot-tracking.png |
| 4-11 | PASS | 에이전트 shot-settings.png — config·데이터 요약·적재 이력·run 표·검증 이력 |
| 4-12 | PASS(round 3) | 6 라우트 200, 콘솔 error 0 — 아래 수정 후 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | 브라우저 스크린샷 공백, `GET /src/hooks/useRun.tsx 404` | 에이전트가 useRun.tsx → useRun.ts + RunProvider.tsx 로 분리한 뒤 Vite dev 서버 모듈 그래프 stale | dev 서버 재기동 | → round 2 |
| 2 | 재기동 후 frontend 프로세스 즉시 종료(rc=1) → honcho 가 web 도 종료 | `pnpm -C ../frontend` 를 backend cwd 에서 호출 → corepack 이 전역 pnpm 11 사용, package.json 핀 `pnpm@9.9.0` 과 불일치 오류 | Procfile.dev `cd ../frontend && pnpm dev`, Makefile test/lint/local-build 도 `cd frontend && pnpm …` | 기동 2초, 6 라우트 200, error 0 → PASS |
## 첨부
- logs/vitest.log, logs/build.log, logs/shot-*.png (overview, frequency, pairs, validation, recommend, tracking)
