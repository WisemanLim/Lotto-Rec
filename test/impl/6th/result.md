# 시험 결과 / Test Result — impl 6th (E9 전략 개선 루프 · S4.8 추천 근거)
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 12, 통과 12, 실패 0 (backend 1 버그 수정, frontend 1 경고 수정) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 6-1~6-6 | PASS | test_experiments.py 단위 (merge_params·β=0 균등·재현성·후보 생성·best-of-K·replay/metrics) |
| 6-7 | PASS | 실험 API sync: 후보 3·n 24·h0.k 3·optimism, 겹침 400, 2세대 parent 자동, 활성화→params_used/experiment/analysis_basis, 계보, 비활성화 |
| 6-8 | PASS | frequency_hot K=4 홀드아웃 CI 방향성 없음 |
| 6-9 | PASS | ExperimentLoop.test (활성 카드 v1·파라미터·판정·새 실험 폼·기준 β 기본값) + 라이브 스크린샷 shot-loop.png (활성 카드·폼·세대 추이 차트·실험 표 2세대 "개선 소멸") |
| 6-10 | PASS | Recommend 결과 세트에 파라미터·활성 실험·분석 근거 블록(data-testid set-basis/analysis-basis), 콘솔 오류 0 |
| 6-11 | PASS | 실 데이터 analysis_weighted 1세대(random K=8) 2s·2세대(coordinate K=6) 2s — PRD §17.4 기록 |
| 6-12 | PASS | tsc 0·eslint 0·vitest 18/18·build OK / pytest 50/50·ruff·mypy 클린 / `make lint`·`make test` 통과 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | pytest 전체가 10분 이상 hang | `propose_candidates` coordinate 탐색에서 범위 클리핑으로 후보가 중복되면 `while len(cands)<n` 무한루프 (bayesian_shrink: 500±step → 10 으로 절단) | 시도 횟수 상한(50·n) 추가, 조기 break 조건 제거 | 8 passed 2.8s |
| 1 | ruff E501 ×2, mypy Optional 연산 | 새 모듈 | 줄바꿈·`float(m.mean())` | 클린 |
| 2 | eslint react-refresh 경고: 컴포넌트 파일에서 `fmtParams` export | 유틸 함수 위치 | `lib/format.ts` 로 이동 | 0 경고 |
## 첨부
- logs/pytest.log, logs/vitest.log, logs/shot-loop.png
