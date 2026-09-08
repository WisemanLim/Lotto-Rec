# 시나리오 — impl 13th: PRD 잔여 (OpenAPI 계약 테스트 · living-doc 상태 갱신)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 13-1 | OpenAPI 계약 | app.openapi() | 스키마 생성 오류 없음, 문서화된 26+ 경로 전부 존재, 스냅샷(`test/backend/openapi_paths.snapshot.json`)과 일치(변경 시 의도적 갱신) | P0 |
| 13-2 | 응답 형태 계약 | /config, /data/summary, /analysis/runs/latest, /recommend/strategies | 필수 키·타입 검증(공통 블록: 시각 ISO 오프셋, 숫자 필드) | P0 |
| 13-3 | living-doc | PRD §12 수용기준 상태표·§13 로드맵 상태·§16 미결 | 구현 결과 반영, COMPLIANCE testing_additions "채택(구현)" 표기 | P0 |
| 13-4 | 게이트 | 전체 | make test/lint 통과 | P0 |
