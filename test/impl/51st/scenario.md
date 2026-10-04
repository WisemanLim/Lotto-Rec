# 시나리오 — impl 51st: 서버 재기동으로 중단된 분석 run 이어서 실행 (PRD v1.33 S2.14) — 2026-10-04

| id | 케이스 | 기대 |
|---|---|---|
| 51-1 | MC 체크포인트 재개 정확성 | 중간 중단(진행 콜백 예외) 후 같은 체크포인트로 재개한 영분포 9종 배열 = 무중단 실행과 비트 동일, 남은 반복만 계산 |
| 51-2 | 메타 불일치·손상 체크포인트 | 무시하고 처음부터(결과 = 신규 실행) |
| 51-3 | 중단 감지 | DB running·스레드 없음 → `mark_interrupted_runs` 가 `interrupted` + stage 사유, 섹션 조회 409 |
| 51-4 | 재개 API | `POST /analysis/runs/{id}/resume` 200 → done, 체크포인트 삭제. 완료 run 재개 409, 없는 run 404 |
| 51-5 | 재개 run = 무중단 run | 같은 seed·B: 체크포인트 후 재개한 run 의 null_summary·global 섹션이 한 번에 실행한 run 과 동일 |
| 51-6 | 시작 훅 + 플래그 | `LOTTO_AUTO_RESUME_RUNS=false` → interrupted 유지·삭제 가능 / `true` → 자동 재개 후 done. `/config` 노출 |
| 51-7 | 화면 | 상태 '중단됨' + 'N% 에서 멈춤' + '이어서 실행' 버튼 → POST resume, 삭제 버튼 활성 |
| 51-8 | 실 환경 E2E | 사용자 DB 의 멈춘 run(b47b04e4, running 25% monte_carlo 40%) — 새 코드로 api 재기동 시 자동 재개, 실행 중 `make docker-restart SVC=api` 후 체크포인트부터 이어서 done |
| 51-9 | 회귀 | `make test`·`make lint` 통과, OpenAPI 스냅샷에 resume 경로 추가 |
