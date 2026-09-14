# 시나리오 — impl 21st: S2.13 회차간 교차 공출현 · `LOTTO_CROSS_DRAW_LAG` · 백업 후 재분석 (PRD v1.10, 사용자 요청 2026-09-14)

| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 21-1 | 이론값 | `p_cross`, T=100·L=5 균등 데이터 | 셀 확률 (6/45)²=4/225, lag ℓ 쌍 수 = T−ℓ, 창 쌍 수 = Σ(T−ℓ), 창 행렬 = lag 행렬 합 | P0 |
| 21-2 | 경계 처리 | 같은 데이터 coverage | 앞 5회차는 '후회차' 역할 0..4, 뒤 5회차는 '전회차' 역할 4..0 — 제외 없이 부분 포함. lag5 첫 쌍 1→6, 마지막 95→100 | P0 |
| 21-3 | 방향·정의 | lag 2 행렬 vs 수동 계수 | `matrix[i-1][j-1]` = #{t: i∈D_t, j∈D_{t+2}}, 합 = (T−2)·36, 비대칭 | P0 |
| 21-4 | 통계량 타당성 | seed 1 균등 시뮬(번호 3 이 202회) | 무조건 이항 z 는 대각 [3,3] > 5 로 부풀지만 조건부 독립성 z 는 \|z\|<4, 대각·비대각 평균 \|z\| 차 < 0.3 | P0 |
| 21-5 | 검출력·거짓경보 | 1→6 강제 신호 주입 / 균등 | lag1·창 최대 셀 [1,6], maxT p<0.05, 경보 2건, 상위 행 sig_fwer / 균등은 경보 0 | P0 |
| 21-6 | 기각률 | 균등 60세트, 창 maxT | 기각 ≤ 9 (α=0.05, Binomial(60,.05) P(X>9)≈0.001) | P1 |
| 21-7 | env | `LOTTO_CROSS_DRAW_LAG` 미설정/7/0 | 기본 5, 7 적용, 0 은 ValueError | P0 |
| 21-8 | run 통합 | 군 A sync run(L=3, MC 200) | 섹션 `cross_draw`(lags 3, 창 쌍 수 Σ(1000−ℓ), partial_tail 끝 = 1000/as_prev 0, p_maxT 존재), summary KPI `cross_draw_*`, verdict flags ⊇ alerts, null_summary `cross_max_lag`·`max_abs_z_cross_window`, diff `cross_draw_p_maxT` | P0 |
| 21-9 | 프론트 | `/cross-draw` mock 렌더 | 경보·간격 KPI·경계 회차 안내·상위 셀 표(전→후, 재출현), lag 선택 시 표 전환 | P0 |
| 21-10 | 재분석 | `make reanalyze PRESET=quick` (실 DB, 1~1,241) | `data/backup/lotto_<UTC>.db` 생성 → 군 A(1~1,000)·B(1,001~1,241)·ALL(1~1,241) run done, 각 run 에 `cross_draw` 섹션 | P0 |
| 21-11 | 게이트 | 전체 | pytest/vitest/ruff/mypy/eslint/tsc 통과, OpenAPI 스냅샷 변화 없음(섹션은 경로 파라미터) | P0 |
