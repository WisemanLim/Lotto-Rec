# 시나리오 — impl 24th: 회차간 상관분석 `.env` 변수 미적용 보고 (PRD v1.11.1, 사용자 보고 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 24-1 | 재현·원인 | `.env.local`, `GET /config`, 설정 화면, 최근 run `cross_draw.max_lag` | 원인 판정: 엔진 적용 여부 vs 노출 여부 | P0 |
| 24-2 | 노출 | `GET /api/v1/config` | `lotto_cross_draw_lag`(int)·`lotto_min_effect_delta`(float)·`lotto_run_retention`(int) 포함, 계약 테스트 단언 | P0 |
| 24-3 | 설정 화면 | `/settings` | 세 키에 설명 문구(env 변수명·변경 시 재분석 필요) | P0 |
| 24-4 | 불일치 안내 | `/cross-draw` mock: run L=2, config L=7 / L=2 | 파란 안내(run L·설정 L·재분석 방법) 표시 / 일치 시 없음, KPI 에 "설정 L=" | P0 |
| 24-5 | 게이트 | 전체 | pytest/vitest/ruff/mypy/eslint/tsc, 라이브 `/config` 에 키 존재 | P0 |
