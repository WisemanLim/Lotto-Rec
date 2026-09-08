# 시험 결과 / Test Result — impl 3rd (E3/E4/E5/E8)
- 일자: 2026-09-08 / 대상: custom(python-fastapi) / 커밋: (git 미초기화)
## 요약
- 전체 13 (파라미터 포함), 통과 13, 실패 0 → 최종 Verdict: **PASS** (round 2)
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 3-1 | PASS | |
| 3-2 | PASS | 6 전략 파라미터화 |
| 3-3 | PASS(round 2) | round 1 실패 — 아래 |
| 3-4~3-8 | PASS | replay 12회 sync 2.3s |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | `'fallback' in meta` 실패 | 폴백 시 재귀 호출 결과 meta 를 그대로 반환 → fallback 표시 유실 | 재귀 결과 meta 에 strategy/fallback 병합 | PASS |
| 2 | (성능) typicality 호출당 200k 행 마할라노비스 재계산 | 캐시 없음 | 영분포 통계 캐시(`_typ_model`) + searchsorted 분위수 → 200회 0.03s | 전체 회귀 41 PASS |
## 첨부
- logs/pytest.log
