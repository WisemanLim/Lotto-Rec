# 결과 — impl 21st: S2.13 회차간 교차 공출현 · `LOTTO_CROSS_DRAW_LAG` · 백업 후 재분석 (PRD v1.10) — 2026-09-14

## 시도 1 — PASS 11/11

| id | 판정 | 근거 |
|---|---|---|
| 21-1 | PASS | `test_cell_probability_and_pair_counts_with_edges`: p×=4/225, lag 쌍 수 [99,98,97,96,95], 창 485, 창 행렬 = lag 합 |
| 21-2 | PASS | 같은 테스트: partial_head as_next [0..4], partial_tail as_prev [4..0], lag5 첫/마지막 쌍 1→6 / 95→100 |
| 21-3 | PASS | `test_cross_matrix_matches_manual_count_and_direction`: 수동 3중 루프 계수와 일치, 합 (T−2)·36, 비대칭 |
| 21-4 | PASS (설계 변경) | 초기 구현(무조건 이항 z)은 균등 시뮬 seed 1 에서 대각 [3,3] z=7.1·maxT 0.012 로 **거짓 경보** — 번호 3 이 202회 출현한 빈도 효과. 주변빈도 조건부 2×2 독립성 z 로 교체 → 같은 데이터 \|z\|<4, 대각·비대각 평균 \|z\| 0.90 vs 0.81 |
| 21-5 | PASS | 1→6 강제 신호: lag1·창 최대 셀 [1,6], z 24, maxT p 0.003(=1/321 하한), 경보 2, 상위 행 sig_fwer·cond_lift>3. 균등: 경보 0, FWER 0 |
| 21-6 | PASS | 60세트 창 maxT 기각 ≤ 9 (사전 200세트 확인: 6.5%) |
| 21-7 | PASS | `test_cross_draw_lag_setting_from_env`: 기본 5, env 7, 0 → ValidationError |
| 21-8 | PASS | `test_run_section_cross_draw_and_kpi`: 섹션·KPI·verdict flags·null_summary·diff 항목 확인 |
| 21-9 | PASS | `CrossDraw.test.tsx` 2건: 경보·KPI·경계 안내·표(전→후, 재출현), lag 선택 전환 |
| 21-10 | PASS | `make reanalyze`: 백업 `data/backup/lotto_20260914T002109Z.db`(12.9MB) → A 45.0s · B 11.1s · ALL 56.8s, 세 run done, `cross_draw` 섹션 존재, 라이브 `GET /analysis/runs/latest?cohort=ALL` = 1~1,241 trigger=reanalyze. 결과는 PRD §17.5 |
| 21-11 | PASS | pytest 72/72 · vitest 39/39 · ruff/mypy/eslint/tsc clean · OpenAPI 스냅샷 변화 없음 |

## 실데이터 요약 (quick, seed 20260908)
| 군 | 회차 | J p | 회차간 창 최대 셀 | z | maxT p | BH/FWER 유의 셀 | 재출현 z |
|---|---|---|---|---|---|---|---|
| A | 1~1,000 | 0.888 | 42→9 | 4.13 | 0.087 | 2 / 0 | 0.70 |
| B | 1,001~1,241 | 0.396 | 15→2 | 3.75 | 0.396 | 0 / 0 | −1.77 |
| ALL | 1~1,241 | 0.874 | 5→27 | 4.03 | 0.125 | 0 / 0 | 0.27 |

## 변경 파일
- backend `core/cross_draw.py`(신규), `core/mc_engine.py`(`max_abs_z_cross` (B,L+1) 열·`cross_max_lag`), `core/config.py`(`lotto_cross_draw_lag`), `services/analysis_service.py`(SECTIONS `cross_draw`, KPI `cross_draw_*`, verdict flags, diff `cross_draw_p_maxT`), `app/reanalyze.py`(신규)
- frontend `pages/CrossDraw.tsx`(신규, `/cross-draw`), `api/client.ts`(`CrossDrawSection`, kpi 필드), `App.tsx`, `lib/labels.ts`(NAV '회차간 연관성'), `lib/glossary.ts`(`cross_draw`·`cross_draw_lag`·`cond_independence_z`), `pages/Overview.tsx`(KPI 카드)
- test `test_cross_draw.py`(7), `CrossDraw.test.tsx`(2)
- infra `Makefile`(`reanalyze` 타겟, PRESET/COHORTS 변수), `.env.local.example`/`.env.local`(`LOTTO_CROSS_DRAW_LAG=5`)
- docs `.docs/PRD.md` v1.10(§4.8·S2.13·§9·§10·§16.4·§17.5), `README.md`/`README.en.md`

## 비고
- Makefile 첫 시도에서 `$(or $(COHORTS),A,B,ALL)` 이 쉼표를 인자 구분자로 해석해 A 만 실행됨 → `COHORTS ?=` 변수로 수정 후 B·ALL 실행(백업 파일 2개 생성: 002109Z = 재분석 전 원본, 002250Z = A 완료 후).
- 기존 `WITH_ENV` 매크로는 `.env.local` 의 따옴표 없는 `APP_NAME=Lotto number recommender` 를 source 하며 `number: command not found` 를 내고 `|| true` 로 넘어감(db-seed/db-migrate 에도 해당, 기능 영향 없음). reanalyze 는 pydantic 이 직접 로드하므로 WITH_ENV 미사용. 별도 수정은 범위 밖으로 미반영.
- 간격 L 은 run 생성 시점 settings 로 고정(섹션 `max_lag`, KPI `cross_draw_lag`). `.env.local` 변경 → `make local-restart` → 새 run.
