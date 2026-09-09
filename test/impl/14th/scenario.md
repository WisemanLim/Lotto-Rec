# 시나리오 — impl 14th: S4.9 과거 1·2등 회차 표시 (PRD v1.5)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 14-1 | 일치 판정 | 386회 본번호 6개(역순) / 5개+보너스 / 5개+비보너스 | rank 1 / rank 2 / 386 미포함, 결과 회차 오름차순 | P0 |
| 14-2 | API 필드 | POST /recommend, GET /recommend/history, GET /tracking/outcomes | 티켓·행마다 `past_wins: list` 포함 | P0 |
| 14-3 | UI 표시 | BallRow pastWins=[{386,1},{712,2}] | `(386)` `(712)` 렌더, text-[10px]·text-neutral-400, 툴팁 `386회 1등 조합과 일치`; 빈 배열이면 미렌더 | P0 |
| 14-4 | 실 데이터 | data/lotto.db 19,220 이력 | 인덱스 생성 < 100ms, 일치 건수·예시 회차 확인 | P1 |
| 14-5 | 게이트 | 전체 | make test(pytest+vitest) · make lint(ruff/mypy/eslint/tsc) 통과, OpenAPI 스냅샷 불변 | P0 |
