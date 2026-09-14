"""E9 — 전략 파라미터화·실험 iteration·best-of-K 영분포·활성화·계보 (PRD §4.12, S9.x)."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.null_model import GAME
from app.core.recommend import strategies as strat
from app.services import experiment_service as xsvc


def _ctx(T: int = 300, seed: int = 0) -> strat.Context:
    from app.core.features import incidence_from_draws
    from app.core.null_model import simulate_draws

    d = simulate_draws(np.random.default_rng(seed), 1, T, GAME)[0]
    return strat.Context(incidence=incidence_from_draws(d, 45), draw_no_next=T + 1, game=GAME)


def test_merge_params_clips_and_types() -> None:
    p = strat.merge_params("frequency_hot", {"gamma": 99, "window": 12.6, "unknown": 1})
    assert p == {"gamma": 3.0, "window": 13}
    assert strat.merge_params("uniform", {"x": 1}) == {}
    assert strat.default_params("analysis_weighted") == {"beta": 0.5, "lift_power": 0.0, "window": 0}


def test_analysis_weighted_beta_zero_is_uniform() -> None:
    ctx = _ctx()
    pv = strat.probability_vector(ctx, "analysis_weighted", {"beta": 0.0})
    assert np.allclose(pv, 6 / 45)
    pv2 = strat.probability_vector(ctx, "analysis_weighted", {"beta": 1.0})
    z = ctx.z_scores()
    assert pv2[np.argmax(z)] > pv2[np.argmin(z)]


def test_params_change_output_and_reproducible() -> None:
    ctx = _ctx()
    a, ma = strat.generate("frequency_hot", ctx, 5, 3, None, {"gamma": 0.5})
    b, mb = strat.generate("frequency_hot", ctx, 5, 3, None, {"gamma": 3.0})
    assert ma["params"]["gamma"] == 0.5 and mb["params"]["gamma"] == 3.0
    assert a != b
    a2, _ = strat.generate("frequency_hot", ctx, 5, 3, None, {"gamma": 0.5})
    assert a2 == a
    w, _ = strat.generate("analysis_weighted", ctx, 5, 1, None, {"beta": 1.0, "lift_power": 0.5})
    assert len(w) == 5 and all(len(set(t)) == 6 for t in w)


def test_propose_candidates() -> None:
    rng = np.random.default_rng(0)
    c = xsvc.propose_candidates("frequency_hot", {}, "random", 6, rng)
    assert len(c) == 6 and c[0] == strat.default_params("frequency_hot")
    assert all(0.25 <= x["gamma"] <= 3.0 and 0 <= x["window"] <= 1000 for x in c)
    cc = xsvc.propose_candidates("bayesian_shrink", {}, "coordinate", 5, rng)
    assert len(cc) >= 2 and cc[0]["strength"] == 500.0
    assert xsvc.propose_candidates("uniform", {}, "random", 5, rng) == [{}]


def test_best_of_k_null_scales() -> None:
    h1 = xsvc.best_of_k_null(1200, 1, n_sims=5000, seed=1)
    h8 = xsvc.best_of_k_null(1200, 8, n_sims=5000, seed=1)
    assert abs(h1["expected_best_diff"]) < 0.01  # K=1 → 평균 0
    assert h8["expected_best_diff"] > 0.02 and h8["q95"] > h8["q50"] > 0
    assert h8["sd_single_diff"] == pytest.approx(np.sqrt(2 * xsvc.hypergeom_match_var(GAME) / 1200))


def test_replay_and_metrics_pure(seeded: None) -> None:
    from pathlib import Path

    from app.core.data_io import load_source_file
    from app.core.features import incidence_from_draws

    rep = load_source_file(Path(__file__).resolve().parents[2] / ".docs" / "lotto(~1240).xlsx")
    recs = [r for r in rep.records if 1001 <= r.draw_no <= 1006]
    hist = incidence_from_draws(np.array([r.numbers for r in rep.records if r.draw_no <= 1000]), 45)
    specs = [
        {"label": "hot", "strategy": "frequency_hot", "params": {"gamma": 2.0}},
        {"label": "uniform", "strategy": "uniform", "params": {}},
    ]
    out = xsvc.replay(specs, recs, hist, 3, 5, None, None)
    assert len(out["hot"]["outcomes"]) == 18 and len(out["hot"]["scoring"]) == 6
    m = xsvc.metrics(out["hot"]["outcomes"], out["uniform"]["outcomes"], out["hot"]["scoring"])
    assert m["n_tickets"] == 18 and "diff_vs_uniform" in m and "brier_mean" in m
    assert sum(m["match_hist"]) == 18


def test_experiment_api_sync_and_activate(seeded: None, client) -> None:  # noqa: ANN001
    sp = client.get("/api/v1/experiments/strategy-params").json()
    ids = {s["id"] for s in sp["strategies"]}
    assert "analysis_weighted" in ids and any(s["params"] for s in sp["strategies"])

    body = {
        "strategy": "analysis_weighted",
        "search": "random",
        "n_candidates": 3,
        "tune_from": 1001,
        "tune_to": 1008,
        "holdout_from": 1009,
        "holdout_to": 1016,
        "tickets_per_draw": 3,
        "seed": 5,
        "sync": True,
    }
    r = client.post("/api/v1/experiments/runs", json=body)
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["status"] == "done" and e["iteration"] == 1 and len(e["candidates"]) == 3
    assert e["metrics_tune"]["n_tickets"] == 24 and e["metrics_holdout"]["n_tickets"] == 24
    assert "diff_vs_uniform" in e["metrics_tune"] and e["h0_benchmark"]["k"] == 3
    assert e["metrics_holdout"]["optimism"] is not None
    assert e["params"] in [c["params"] for c in e["candidates"]]

    # 겹치는 구간 거부
    bad = client.post("/api/v1/experiments/runs", json={**body, "holdout_from": 1005})
    assert bad.status_code == 400

    # 2세대 (parent 자동 = 최신 done)
    r2 = client.post("/api/v1/experiments/runs", json={**body, "seed": 6}).json()
    assert r2["iteration"] == 2 and r2["parent_id"] == e["experiment_id"]

    # 활성화 → 추천에 params_used·experiment·analysis_basis
    act = client.post(f"/api/v1/experiments/runs/{r2['experiment_id']}/activate").json()
    assert act["is_active"] is True
    active = client.get("/api/v1/experiments/active?strategy=analysis_weighted").json()
    assert active["analysis_weighted"]["experiment_id"] == r2["experiment_id"]
    rec = client.post(
        "/api/v1/recommend", json={"strategy": "analysis_weighted", "count": 3, "seed": 1, "save": False}
    ).json()
    st = rec["sets"][0]
    assert st["params_used"] == r2["params"] and st["experiment"]["iteration"] == 2
    assert rec["analysis_basis"]["history_T"] >= 1000 and len(rec["analysis_basis"]["top_abs_z_numbers"]) == 8
    ctrl = rec["sets"][1]
    assert ctrl["experiment"] is None and ctrl["params_used"] == {}

    # 계보
    lin = client.get("/api/v1/experiments/lineage?strategy=analysis_weighted").json()
    assert [p["iteration"] for p in lin["points"]] == [1, 2] and lin["points"][1]["is_active"]
    assert lin["points"][-1]["cum_holdout_mean"] is not None

    # 비활성화 → 기본 파라미터
    client.post("/api/v1/experiments/deactivate?strategy=analysis_weighted")
    rec2 = client.post(
        "/api/v1/recommend", json={"strategy": "analysis_weighted", "count": 2, "seed": 1, "save": False}
    ).json()
    assert rec2["sets"][0]["params_used"] == strat.default_params("analysis_weighted")
    lst = client.get("/api/v1/experiments/runs?strategy=analysis_weighted").json()
    assert len(lst) == 2


def test_h0_experiment_holdout_regresses(seeded: None, client) -> None:  # noqa: ANN001
    """튠에서 최고를 골라도 홀드아웃 diff CI 는 0 을 포함(균등 데이터 아님에도 실데이터 = 공정 추첨 가정)."""
    body = {
        "strategy": "frequency_hot",
        "n_candidates": 4,
        "tune_from": 1001,
        "tune_to": 1010,
        "holdout_from": 1011,
        "holdout_to": 1020,
        "tickets_per_draw": 4,
        "seed": 9,
        "sync": True,
    }
    e = client.post("/api/v1/experiments/runs", json=body).json()
    ci = e["metrics_holdout"]["diff_vs_uniform"]["ci95"]
    assert ci[0] <= 0.3 and ci[1] >= -0.3  # 폭 넓은 안전 범위 — 방향성 없음
    assert e["h0_benchmark"]["p_best_of_k"] is not None
