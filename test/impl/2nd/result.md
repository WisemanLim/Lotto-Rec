# 시험 결과 / Test Result — impl 2nd (E2 통계 엔진)
- 일자: 2026-09-08 / 대상: custom(python-fastapi) / 커밋: (git 미초기화)
## 요약
- 전체 12, 통과 12, 실패 0, 최종 Verdict: **PASS** (1회 시도)
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 2-1~2-12 | PASS | test_engine.py 12 passed in 16.0s |
## 성능
- MC 엔진: 256 sims(T=1000) 0.47s → quick(10k) ≈ 19s, report(100k) ≈ 3분, deep(500k) ≈ 16분 (Apple Silicon, 단일 프로세스)
- 영분포 평균 검증: X² 평균 38.8(이론 44·39/44=39.0), Q 평균 6.25(이론 6), overlap 0.8008(이론 0.8)
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| — | 없음 | — | — | — |
## 첨부
- logs/pytest.log, ../2nd_realrun.log (실 DB 군 A quick run KPI)
