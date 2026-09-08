# 시험 결과 / Test Result — impl 1st (E1 데이터)
- 일자: 2026-09-08 / 대상: custom(python-fastapi) / 커밋: (git 미초기화)
## 요약
- 전체 8 (파라미터 포함), 통과 8, 실패 0, 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 1-1 | PASS | test_parse_source_file_clean |
| 1-2 | PASS | test_parse_rejects_bad_rows |
| 1-3 | PASS | test_seed_loads_cohort_a_only; 실 DB seed inserted=1000 |
| 1-4 | PASS | test_incremental_import_skips_duplicates_and_inserts_new |
| 1-5 | PASS | test_conflict_is_reported_not_overwritten |
| 1-6 | PASS | test_manual_draw_input_and_summary |
| 1-7 | PASS | test_unsupported_format[x.pdf], [x.json] |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | (실행 전 정적) DrawIn validator SyntaxError | `any(... else False ...)` 잘못된 표현식 | `not (1 <= x <= 45)` | PASS |
| 1 | (설계) 테스트가 실 DB 사용 위험 | Settings 가 import 시점 로드 | conftest 모듈 레벨에서 DATABASE_URL 임시 경로 고정 | PASS |
## 첨부
- logs/pytest.log
