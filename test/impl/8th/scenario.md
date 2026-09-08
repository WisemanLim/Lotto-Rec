# 시나리오 — impl 8th: PRD 잔여 3건 (S8.4 run 차이 요약 · Q5 run 보존 · §12.2 검정력)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 8-1 | diff_vs_previous | 같은 군 run 2회(sync) | 2번째 run 에 섹션 존재: previous_run_id, 전역 p 변화, 유의 번호/쌍 added/removed, verdict 변화, summary 문구; 첫 run 은 previous 없음 | P0 |
| 8-2 | 설정 화면 표시 | run 표 | "이전 대비" 열에 요약 문구 | P1 |
| 8-3 | 보존 정리 | LOTTO_RUN_RETENTION=3 에서 run 5회 | done run ≤3 유지 + 군별 최신 보존, 결과 섹션 함께 삭제, 0 이면 무제한 | P0 |
| 8-4 | 편향 검정력 | 번호 7 가중 1.3배, T=1000, 60세트 | J 기각률 ≥ 0.8, 균등 데이터는 ≈α | P0 |
| 8-5 | 게이트 | 전체 | pytest/vitest/lint/build 통과 | P0 |
