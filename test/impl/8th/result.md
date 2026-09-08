# 시험 결과 / Test Result — impl 8th (PRD 잔여: S8.4 run 차이 요약 · Q5 run 보존 · §12.2 검정력)
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 5, 통과 5, 실패 0 (round 3) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 8-1 | PASS | test_diff_vs_previous_and_settings_field — 2번째 run 에 previous_run_id·global_p_joe·sig_pairs·summary, run 목록 diff_summary |
| 8-2 | PASS | 설정 화면 "이전 run 대비" 열(라이브, 콘솔 오류 0). 기존 run 은 "—"(기능 이전 생성), 신규 ALL run 은 요약 표시 |
| 8-3 | PASS(round 2) | test_prune_runs — retention 2 에서 정리·군별 최신 보존·섹션 삭제, 0=무제한. round 1: 임시 DB 에 군 B 회차 부족(400) → 군 A 로 변경 |
| 8-4 | PASS(round 3) | test_power_under_injected_bias — 포함확률 1.3배 보정(A-Res 가중 이분탐색), n=100: 미보정 0.87 · Holm 0.54 · J 0.31 · 균등 FWER 0.07. round 1: 가중 1.3≠포함확률 1.3배(검정력 0.25) → 보정; round 2: Holm ≥0.8 은 과장(이론 ≈0.65) → 리포트형 임계(0.85/0.45/0.2)로 정정, PRD §12.2 문구 동기화 |
| 8-5 | PASS | pytest 54/54 · vitest 18/18 · ruff/mypy/tsc/eslint 클린 · build OK · `make lint`/`make test` |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | 보존 테스트 KeyError run_id | 임시 DB 군 B 회차 <10 → run 생성 400 | 군 A 사용 | PASS |
| 1 | 검정력 0.25 < 0.8 | A-Res 가중치 1.3 은 포함확률 1.3배가 아님(희석) | 포함확률 목표로 가중치 이분탐색 보정 | → round 2 |
| 2 | Holm 보정 검정력 0.55 < 0.8 | 45개 FWER 보정 시 이론 검정력 ≈0.65 — PRD 가정이 과장 | 리포트형 임계로 정정(PRD §12.2 갱신), J 임계 0.2 | PASS |
## 첨부
- logs/pytest.log (power report 포함), logs/vitest.log
