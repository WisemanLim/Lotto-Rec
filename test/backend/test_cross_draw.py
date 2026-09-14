"""S2.13 회차간 교차 공출현 (PRD §4.8, v1.10) — 이론값·경계 커버리지·신호 검출·env·run 섹션."""

from __future__ import annotations

import numpy as np
import pytest

from app.core import cross_draw as cd
from app.core.mc_engine import run_null_simulation
from app.core.null_model import GAME, draws_to_incidence, simulate_draws


def _uniform(seed: int, T: int) -> np.ndarray:
    return draws_to_incidence(simulate_draws(np.random.default_rng(seed), 1, T, GAME), GAME.N)[0]


def test_cell_probability_and_pair_counts_with_edges() -> None:
    """셀 확률 (k/N)²=4/225, lag ℓ 쌍 수 = T−ℓ (경계 회차 포함), 창 = Σ(T−ℓ)."""
    assert abs(cd.p_cross(GAME) - 4 / 225) < 1e-12
    T, L = 100, 5
    x = _uniform(1, T)
    r = cd.cross_draw_analysis(x, np.arange(1, T + 1), L, GAME, 0.05, None)
    assert [lg["summary"]["n_pairs"] for lg in r["lags"]] == [T - lg for lg in range(1, L + 1)]
    assert r["window"]["summary"]["n_pairs"] == sum(T - lg for lg in range(1, L + 1))
    assert r["window"]["summary"]["n_cells"] == GAME.N**2
    assert abs(r["lags"][0]["summary"]["expected"] - (T - 1) * 4 / 225) < 1e-9
    # 창 행렬 = lag 별 행렬 합
    assert np.array_equal(np.array(r["window"]["matrix"]), sum(np.array(lg["matrix"]) for lg in r["lags"]))
    # 경계: 앞 L 회차는 '후회차' 역할 L 미만, 뒤 L 회차는 '전회차' 역할 L 미만 — 제외되지 않고 부분 포함
    cov = r["coverage"]
    assert cov["n_draws_partial_head"] == L and cov["n_draws_partial_tail"] == L
    assert [d["as_next"] for d in cov["partial_head"]] == [0, 1, 2, 3, 4]
    assert [d["as_prev"] for d in cov["partial_tail"]] == [4, 3, 2, 1, 0]
    assert r["lags"][0]["draw_pairs"] == {"first": [1, 2], "last": [99, 100]}
    assert r["lags"][4]["draw_pairs"] == {"first": [1, 6], "last": [95, 100]}


def test_cross_matrix_matches_manual_count_and_direction() -> None:
    """matrix[i-1][j-1] = #{t: i∈D_t, j∈D_{t+ℓ}} — 방향 있음 (i→j ≠ j→i)."""
    T = 60
    x = _uniform(2, T)
    m = cd.cross_cooccurrence(x, 2)
    manual = np.zeros((GAME.N, GAME.N), dtype=int)
    for t in range(T - 2):
        for i in np.flatnonzero(x[t]):
            for j in np.flatnonzero(x[t + 2]):
                manual[i, j] += 1
    assert np.array_equal(m, manual)
    assert m.sum() == (T - 2) * GAME.k**2
    assert not np.array_equal(m, m.T)


def test_conditional_z_removes_frequency_inflation() -> None:
    """무조건 이항 z 는 자주 나온 번호의 대각 셀을 부풀리지만 조건부 z 는 그렇지 않다 (seed 1: 번호 3 = 202회)."""
    T = 1241
    x = _uniform(1, T)
    assert x.sum(axis=0)[2] == 202
    m1 = cd.cross_cooccurrence(x, 1)
    p = cd.p_cross(GAME)
    z_uncond = (m1[2, 2] - (T - 1) * p) / np.sqrt((T - 1) * p * (1 - p))
    assert z_uncond > 5
    r = cd.cross_draw_analysis(x, np.arange(1, T + 1), 5, GAME, 0.05, None)
    z = np.array(r["lags"][0]["z_matrix"])
    assert abs(z[2, 2]) < 4
    zw = np.array(r["window"]["z_matrix"])
    diag, off = np.abs(np.diag(zw)).mean(), np.abs(zw[~np.eye(GAME.N, dtype=bool)]).mean()
    assert abs(diag - off) < 0.3


def test_injected_signal_detected_and_uniform_not_flagged() -> None:
    """1 이 t 에 나오면 t+1 에 6 을 강제 → lag1·창 최대 셀 [1,6] FWER 유의. 균등 데이터는 경보 없음."""
    T = 600
    nd = run_null_simulation(T, 200, 11, GAME, chunk=50, cross_max_lag=3)
    assert nd.max_abs_z_cross.shape == (200, 4)
    x = _uniform(3, T).copy()
    for t in range(T - 1):
        if x[t, 0] == 1 and x[t + 1, 5] == 0:
            j = np.flatnonzero(x[t + 1])[0]
            x[t + 1, j] = 0
            x[t + 1, 5] = 1
    r = cd.cross_draw_analysis(x, np.arange(1, T + 1), 3, GAME, 0.05, nd.max_abs_z_cross)
    assert r["lags"][0]["summary"]["max_cell"] == [1, 6]
    assert r["lags"][0]["summary"]["max_cell_p_maxT"] < 0.05
    assert r["window"]["summary"]["max_cell"] == [1, 6]
    assert r["any_lag"]["lag"] == 1 and r["any_lag"]["n_tests"] == 3 * GAME.N**2
    assert len(r["alerts"]) == 2
    top = r["lags"][0]["rows"][0]
    assert (top["prev"], top["next"]) == (1, 6) and top["sig_fwer"] and top["cond_lift"] > 3
    u = cd.cross_draw_analysis(_uniform(4, T), np.arange(1, T + 1), 3, GAME, 0.05, nd.max_abs_z_cross)
    assert u["alerts"] == [] and u["window"]["summary"]["n_sig_fwer"] == 0
    assert len(u["lags"][0]["rows"]) == cd.TOP_ROWS_PER_LAG and len(u["window"]["rows"]) == GAME.N**2


def test_maxt_rejection_rate_near_alpha() -> None:
    """§12.2: 균등 시뮬 60세트에서 창 maxT 기각률 ≈ α (0.05 ± 넉넉한 허용)."""
    T = 200
    nd = run_null_simulation(T, 300, 21, GAME, chunk=60, cross_max_lag=2)
    xs = draws_to_incidence(simulate_draws(np.random.default_rng(22), 60, T, GAME), GAME.N)
    rej = sum(
        cd.cross_draw_analysis(xs[s], np.arange(1, T + 1), 2, GAME, 0.05, nd.max_abs_z_cross)["window"]["summary"][
            "max_cell_p_maxT"
        ]
        < 0.05
        for s in range(60)
    )
    assert rej <= 9  # Binomial(60, .05): P(X>9) ≈ 0.001


def test_cross_draw_lag_setting_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import Settings

    # 필드 기본값 5 (.env.local 은 사용자 값이라 파일 값은 단언하지 않음)
    assert Settings.model_fields["lotto_cross_draw_lag"].default == 5
    monkeypatch.setenv("LOTTO_CROSS_DRAW_LAG", "7")
    assert Settings().lotto_cross_draw_lag == 7
    monkeypatch.setenv("LOTTO_CROSS_DRAW_LAG", "0")
    with pytest.raises(ValueError):
        Settings()


def test_run_section_cross_draw_and_kpi(seeded: None, client, monkeypatch) -> None:  # noqa: ANN001
    """분석 run 에 `cross_draw` 섹션·요약 KPI·diff 항목이 포함되고 API 로 조회된다."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "lotto_cross_draw_lag", 3)
    body = {"cohort": "A", "preset": "quick", "mc_iterations": 200, "sync": True}
    r = client.post("/api/v1/analysis/runs", json=body)
    assert r.status_code == 200 and r.json()["status"] == "done", r.json()
    rid = r.json()["run_id"]
    sec = client.get(f"/api/v1/analysis/runs/{rid}/cross_draw").json()
    assert sec["max_lag"] == 3 and len(sec["lags"]) == 3
    assert sec["window"]["summary"]["n_pairs"] == sum(1000 - lg for lg in (1, 2, 3))
    assert sec["coverage"]["partial_tail"][-1] == {"draw_no": 1000, "as_prev": 0}
    assert sec["window"]["rows"][0]["p_maxT"] is not None
    summ = client.get(f"/api/v1/analysis/runs/{rid}/summary").json()
    kpi = summ["kpi"]
    assert kpi["cross_draw_lag"] == 3 and kpi["cross_draw_max_cell"] == sec["window"]["summary"]["max_cell"]
    assert kpi["cross_draw_p_maxT"] == sec["window"]["summary"]["max_cell_p_maxT"]
    assert set(sec["alerts"]) <= set(summ["verdict"]["flags"])
    ns = client.get(f"/api/v1/analysis/runs/{rid}/null_summary").json()
    assert ns["cross_max_lag"] == 3 and "q95" in ns["max_abs_z_cross_window"]
    diff = client.get(f"/api/v1/analysis/runs/{rid}/diff_vs_previous").json()
    assert "cross_draw_p_maxT" in diff or diff["previous_run_id"] is None
