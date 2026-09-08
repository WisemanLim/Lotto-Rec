# 시험 결과 / Test Result — impl 12th (표시 시간대 KST, PRD v1.3)
- 일자: 2026-09-08 / 대상: custom(python-fastapi + react) / 커밋: (git 미초기화)
## 요약
- 전체 6, 통과 6, 실패 0 → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 12-1 | PASS | 원인 확정: `DateTime(timezone=True)` 도 SQLite 는 tz 폐기 → `isoformat()` 이 `2026-09-08T06:02:55.356324`(오프셋 없음) 반환 → 브라우저 `new Date()` 가 로컬(KST)로 해석 → 실제 15:02 KST 가 06:02 로 표시 |
| 12-2 | PASS | `app/core/timeutil.to_iso()` — naive→UTC 부여, `+00:00` 포함. 7개 파일 13개 `isoformat()` 치환. test_health: imports[0].created_at endswith('+00:00') |
| 12-3 | PASS | `LOTTO_TIMEZONE=Asia/Seoul`(.env.local·.example), `VITE_TIMEZONE`, `/config.timezone` |
| 12-4 | PASS | format.test — `06:02:55+00:00`·`Z`·naive 모두 → "2026. 9. 8. 15:02:55"; 잘못된 IANA 무시; UTC 로 전환 시 06:02. 헤더 배지 "KST (UTC+9)" |
| 12-5 | PASS | 라이브: API created_at `2026-09-08T07:19:48+00:00` → 설정 화면 "2026. 9. 8. 16:19:48" (+9h) |
| 12-6 | PASS | pytest 56/56 · ruff/mypy 클린 · format/App vitest PASS (전체 프론트 게이트는 impl/11th 와 함께) |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| — | 배지 "UTC+09" 표기 | Intl longOffset 이 2자리 시간 | 선행 0 제거 → "UTC+9" | PASS |
## 첨부
- logs/pytest.log, logs/vitest.log
