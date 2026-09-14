"""E2 — 통계 엔진 이론값(PRD §12.1)·시뮬 기각률(§12.2)·run 파이프라인."""

from __future__ import annotations

import numpy as np
import pytest
from scipy import stats

from app.core import groups, itemsets, order_stats, pairs, temporal
from app.core.multiple_testing import adjust_all, maxt_pvalues
from app.core.null_model import GAME, iter_null_chunks, mc_pvalue, simulate_draws


def test_game_constants() -> None:
    assert abs(GAME.p_pair - 1 / 66) < 1e-12
    assert abs(GAME.naive_lift_null - 225 / 264) < 1e-12
    assert abs(GAME.corr_null + 1 / 44) < 1e-12
    assert abs(GAME.joe_factor - 44 / 39) < 1e-12
    assert abs(GAME.p_conditional(2, 1) - 4 / 43) < 1e-12
    assert abs(GAME.p_conditional(2, 2) - 12 / (43 * 42)) < 1e-12
    md = GAME.match_distribution()
    assert abs(md.sum() - 1) < 1e-12 and abs((np.arange(7) * md).sum() - 0.8) < 1e-12
    assert abs(GAME.expected_overlap - 0.8) < 1e-12 and abs(GAME.overlap_pmf().sum() - 1) < 1e-12
    rp = GAME.rank_probabilities()
    assert abs(rp["rank1"] - 1 / 8_145_060) < 1e-15 and abs(rp["rank2"] - 6 / 8_145_060) < 1e-15
    assert abs(rp["rank5"] - 0.0224406) < 1e-6


def test_order_stat_moments_and_genest_weights() -> None:
    mu = GAME.order_stat_mean()
    assert [round(m, 2) for m in mu] == [6.57, 13.14, 19.71, 26.29, 32.86, 39.43]
    V = GAME.order_stat_cov()
    assert np.allclose(V, V.T) and np.all(np.linalg.eigvalsh(V) > 0)
    Vinv = np.linalg.inv(V)
    # Coronel-Brizio: V⁻¹ 은 삼중대각
    off = Vinv.copy()
    for d in (-1, 0, 1):
        off -= np.diag(np.diag(Vinv, d), d)
    assert np.allclose(off, 0, atol=1e-9)
    w1, w2, df1, df2 = GAME.genest_pair_weights()
    assert abs(w1 * df1 + w2 * df2 - (990 - 15)) < 1e-9  # E = C(N,2) - C(k,2)


def test_simulator_rows_are_valid() -> None:
    rng = np.random.default_rng(0)
    d = simulate_draws(rng, 5, 100, GAME)
    assert d.shape == (5, 100, 6)
    assert np.all(np.diff(d, axis=2) > 0) and d.min() >= 1 and d.max() <= 45
    for draws, x in iter_null_chunks(1, 10, 50, GAME, chunk=4):
        assert np.all(x.sum(axis=2) == 6)


def test_pearson_vs_joe_rejection_rate() -> None:
    """§12.2: 균등 시뮬에서 naive χ² 과소기각, J ≈ α."""
    rng = np.random.default_rng(42)
    n, T, alpha = 600, 1000, 0.05
    rej_naive = rej_joe = 0
    for draws, x in iter_null_chunks(7, n, T, GAME, chunk=100):
        counts = x.sum(axis=1)
        e = T * GAME.p_single
        X2 = np.sum((counts - e) ** 2 / e, axis=1)
        rej_naive += int(np.sum(stats.chi2.sf(X2, 44) < alpha))
        rej_joe += int(np.sum(stats.chi2.sf(GAME.joe_factor * X2, 44) < alpha))
    assert rej_naive / n < 0.03  # 보수적(과소기각)
    assert 0.03 <= rej_joe / n <= 0.075  # ≈ α ± MC 오차


def test_order_stat_q_calibrated() -> None:
    rng = np.random.default_rng(3)
    d = simulate_draws(rng, 400, 1000, GAME).astype(float)
    q = order_stats.q_statistic_batch(d, GAME)
    assert 0.02 <= np.mean(stats.chi2.sf(q, 6) < 0.05) <= 0.09
    assert abs(q.mean() - 6) < 0.6


def test_pair_analysis_shapes_and_null_lift() -> None:
    rng = np.random.default_rng(5)
    d = simulate_draws(rng, 1, 1000, GAME)[0]
    from app.core.features import incidence_from_draws

    x = incidence_from_draws(d, 45)
    res = pairs.pair_analysis(
        x, GAME, 0.05, 0.25, null_max_z=np.array([3.5, 4.0, 4.5]), null_genest=np.array([900.0, 1000.0])
    )
    assert len(res["rows"]) == 990 and res["summary"]["expected"] == pytest.approx(1000 / 66)
    lifts = np.array([r["calibrated_lift"] for r in res["rows"]])
    assert abs(lifts.mean() - 1) < 0.05  # 설계 보정 lift 평균 ≈ 1
    assert all("p_maxT" in r for r in res["rows"])


def test_multiple_testing_and_maxt() -> None:
    p = np.array([0.001, 0.01, 0.04, 0.2, 0.5])
    adj = adjust_all(p, 0.05)
    assert np.allclose(adj["p_bonferroni"], np.minimum(1, p * 5))
    assert np.all(adj["q_bh"] >= p) and np.all(adj["q_by"] >= adj["q_bh"])
    pm = maxt_pvalues(np.array([5.0, 1.0]), np.array([2.0, 3.0, 4.0, 4.5]))
    assert pm[0] == pytest.approx(1 / 5) and pm[1] == pytest.approx(1.0)
    assert mc_pvalue(np.array([1, 2, 3, 4]), 3.5) == pytest.approx(2 / 5)


def test_itemsets_and_conditional() -> None:
    x = np.zeros((100, 45), dtype=np.int8)
    x[:, :6] = 1  # 항상 1~6
    s = itemsets.itemset_stats(x, [1, 2, 3], GAME)
    assert s["observed"] == 100 and s["calibrated_lift"] > 100
    c = itemsets.conditional_stats(x, [1], [2, 3], GAME)
    assert c["cond_prob"] == 1.0 and c["cond_prob_null"] == pytest.approx(4 / 43)
    with pytest.raises(ValueError):
        itemsets.conditional_stats(x, [1], [1, 2], GAME)


def test_groups_hypergeom_means() -> None:
    rng = np.random.default_rng(9)
    d = simulate_draws(rng, 1, 2000, GAME)[0]
    g = groups.group_analysis(d, GAME, None)
    odd = g["schemes"]["odd_count"]
    assert odd["expected_mean"] == pytest.approx(6 * 23 / 45)
    assert abs(odd["observed_mean"] - odd["expected_mean"]) < 0.15
    assert odd["p"] > 0.001


def test_temporal_overlap_and_runs() -> None:
    rng = np.random.default_rng(11)
    d = simulate_draws(rng, 1, 1000, GAME)[0]
    from app.core.features import incidence_from_draws

    x = incidence_from_draws(d, 45)
    res = temporal.temporal_analysis(x, d, np.arange(1, 1001), GAME, 0.05, 5, np.array([0.8, 0.81, 0.79]), None, None)
    assert abs(res["overlap"]["mean"] - 0.8) < 0.12
    assert len(res["runs"]) == 45 and res["autocorr"]["n_tests"] == 45 * 5
    r = temporal.runs_test_binary(np.array([1, 0, 1, 0, 1, 0, 1, 0]))
    assert r["runs"] == 8 and r["z"] > 2


def test_analysis_run_pipeline_sync(seeded: None, client) -> None:  # noqa: ANN001
    res = client.post(
        "/api/v1/analysis/runs", json={"cohort": "A", "preset": "quick", "mc_iterations": 200, "sync": True}
    )
    assert res.status_code == 200, res.text
    run = res.json()
    assert run["status"] == "done", run
    assert run["n_draws"] == 1000
    rid = run["run_id"]
    summ = client.get(f"/api/v1/analysis/runs/{rid}/summary").json()
    assert summ["T"] == 1000 and "kpi" in summ and "verdict" in summ
    freq = client.get(f"/api/v1/analysis/runs/{rid}/frequency").json()
    assert len(freq["rows"]) == 45 and freq["expected"] == pytest.approx(1000 * 6 / 45)
    pr = client.get(f"/api/v1/analysis/runs/{rid}/pairs").json()
    assert pr["summary"]["n_pairs"] == 990
    glob = client.get(f"/api/v1/analysis/runs/{rid}/global").json()
    assert "joe_J" in glob and "order_stat_Q" in glob and glob["joe_J"]["p_mc"] is not None
    grp = client.get(f"/api/v1/analysis/runs/{rid}/groups").json()
    assert "odd_count" in grp["schemes"] and "sum" in grp["schemes"]
    tmp = client.get(f"/api/v1/analysis/runs/{rid}/temporal").json()
    assert "overlap" in tmp and "changepoint" in tmp
    wm = client.get(f"/api/v1/analysis/runs/{rid}/winners_model").json()
    assert "coef" in wm
    net = client.get(f"/api/v1/analysis/runs/{rid}/network").json()
    assert len(net["nodes"]) == 45
    latest = client.get("/api/v1/analysis/runs/latest?cohort=A").json()
    assert latest["run_id"] == rid
    q = client.post("/api/v1/analysis/itemsets/query", json={"target": [1], "given": [2, 3], "items": [1, 2]}).json()
    assert q["conditional"]["cond_prob_null"] == pytest.approx(4 / 43) and q["itemset"]["size"] == 2


def test_reproducibility_same_seed(seeded: None, client) -> None:  # noqa: ANN001
    a = client.post(
        "/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 150, "seed": 77, "sync": True}
    ).json()
    b = client.post(
        "/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 150, "seed": 77, "sync": True}
    ).json()
    ga = client.get(f"/api/v1/analysis/runs/{a['run_id']}/global").json()
    gb = client.get(f"/api/v1/analysis/runs/{b['run_id']}/global").json()
    assert ga == gb
    assert a["data_hash"] == b["data_hash"]
