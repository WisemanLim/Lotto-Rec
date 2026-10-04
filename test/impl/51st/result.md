# 결과 — impl 51st: 중단된 분석 run 이어서 실행 (PRD v1.33 S2.14) — 2026-10-04

## 시도 1 — PASS 9/9 (lint 2건 수정 후)

| id | 판정 | 근거 |
|---|---|---|
| 51-1 | PASS | `test_checkpoint_resume_is_bit_identical` (T=60, B=400, chunk 40, L=2, 4번째 청크에서 중단) |
| 51-2 | PASS | `test_checkpoint_with_different_meta_is_ignored`, `test_corrupt_checkpoint_is_ignored` |
| 51-3 | PASS | `test_orphan_marked_interrupted_and_resume_api` (상태·stage·섹션 409) |
| 51-4 | PASS | 같은 테스트: resume 200 → done, `checkpoint_path` 없음, 재개 409/404 |
| 51-5 | PASS | `test_resumed_run_equals_uninterrupted_run` (seed 91, B=320) |
| 51-6 | PASS | `test_startup_hook_respects_auto_resume_flag`, `test_config_exposes_auto_resume` |
| 51-7 | PASS | vitest `Settings.resume.test.tsx` |
| 51-8 | PASS | 포트 8000 은 사용자가 14:59 에 띄운 local 컨테이너(구 코드)였음 → `make local-build` 로 새 이미지 기동: 시작 시 run b47b04e4 자동 재개(구 코드라 체크포인트 없어 0% 부터). MC 21% 시점 `make docker-restart SVC=api` → 재기동 직후 `running 0.133 monte_carlo 20%`(마지막 체크포인트) 부터 진행 → `done 1.0`, diff `J p 0.886→0.863`, `data/cache/runs/` 비워짐 |
| 51-9 | PASS | pytest 137 passed, vitest 96 passed. lint: ruff E501(1줄) + mypy `np.savez(**arrays)` arg-type → 줄바꿈·`dict[str, Any]` 로 수정 후 clean |

## 설계 결정
- 재개 단위: MC(전체 시간의 대부분)만 체크포인트, 이후 단계(수 초)는 재계산. 체크포인트 간격 30초 고정(설정 키 추가 안 함).
- 체크포인트 = 누적 통계량 배열 + 완료 반복수 + PCG64 상태(JSON) — 청크 경계가 같아 재개 결과가 비트 동일(seed 재현성 유지).
- 새 상태 `interrupted` 는 String 컬럼 값 추가라 마이그레이션 불필요.
- 자동 재개 기본 true (`LOTTO_AUTO_RESUME_RUNS`), 수동 버튼은 false 이거나 재개 실패 대비.
- 범위 밖(잔여): 검증 replay·전략 개선 루프 실행의 재개, honcho+docker 동시 구동 시 중복 재개 방지.
