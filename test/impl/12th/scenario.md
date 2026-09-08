# 시나리오 — impl 12th: 표시 시간대 KST (PRD v1.3, LOTTO_TIMEZONE)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 12-1 | 원인 확인 | run created_at | 백엔드 ISO 에 오프셋 없음(naive) → 브라우저가 로컬로 해석 → 9h 빠름/느림 표시 | P0 |
| 12-2 | 백엔드 직렬화 | 모든 시각 필드 | `to_iso()` 로 `+00:00` 오프셋 포함, 13개 isoformat 치환 | P0 |
| 12-3 | 설정 | .env.local/.example `LOTTO_TIMEZONE`, `/config.timezone` | Asia/Seoul 노출 | P0 |
| 12-4 | 프론트 표시 | fmtDate | UTC 06:02:55 → "2026. 9. 8. 15:02:55"; 오프셋 없는 문자열도 UTC 로 간주; 헤더에 "KST (UTC+9)" 배지 | P0 |
| 12-5 | 라이브 | 설정 화면 run 시각 | DB UTC 시각 +9h 로 표시 | P0 |
| 12-6 | 게이트 | 전체 | pytest/vitest/lint/build | P0 |
