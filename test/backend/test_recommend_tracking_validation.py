"""E3/E4/E5/E8 — 추천·스코어카드·성과 추적·검증 replay."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.null_model import GAME
from app.core.recommend import strategies as strat


def _ctx(T: int = 300, seed: int = 0) -> strat.Context:
    from app.core.features import incidence_from_draws
    from app.core.null_model import simulate_draws

    d = simulate_draws(np.random.default_rng(seed), 1, T, GAME)[0]
    return strat.Context(incidence=incidence_from_draws(d, 45), draw_no_next=T + 1, game=GAME)


def test_weighted_sampling_valid_and_reproducible() -> None:
    rng = np.random.default_rng(1)
    w = np.arange(1, 46, dtype=float)
    t = strat.weighted_sample_without_replacement(rng, w, 6)
    assert len(t) == 6 and len(set(t)) == 6 and 1 <= t.min() and t.max() <= 45 and list(t) == sorted(t)
    # 가중치 큰 번호가 더 자주
    rng = np.random.default_rng(2)
    hits = np.zeros(45)
    for _ in range(3000):
        hits[strat.weighted_sample_without_replacement(rng, w, 6) - 1] += 1
    assert hits[-5:].mean() > hits[:5].mean() * 3


@pytest.mark.parametrize("s", ["uniform", "frequency_hot", "frequency_cold", "bayesian_shrink", "pair_association", "pattern_typical"])
def test_each_strategy_generates(s: str) -> None:
    ctx = _ctx()
    if s == "pattern_typical":
        from app.core.groups import null_feature_sample

        ctx.null_features = null_feature_sample(0, 20_000, GAME)
    tickets, meta = strat.generate(s, ctx, 10, seed=5, max_shared=3)
    assert len(tickets) == 10 and all(len(t) == 6 and len(set(t)) == 6 for t in tickets)
    assert len({tuple(t) for t in tickets}) == 10
    for i in range(10):
        for j in range(i + 1, 10):
            assert len(set(tickets[i]) & set(tickets[j])) <= 3
    again, _ = strat.generate(s, ctx, 10, seed=5, max_shared=3)
    assert again == tickets  # 재현성


def test_low_competition_falls_back_without_model() -> None:
    ctx = _ctx()
    tickets, meta = strat.generate("low_competition", ctx, 5, seed=1)
    assert len(tickets) == 5 and "fallback" in meta


def test_probability_vector_sums_to_k() -> None:
    ctx = _ctx()
    for s in ("uniform", "frequency_hot", "bayesian_shrink"):
        p = strat.probability_vector(ctx, s)
        assert abs(p.sum() - 6) < 1e-6 and p.min() > 0


def test_recommend_api_count_from_env_and_scorecard(seeded: None, client) -> None:  # noqa: ANN001
    cfg = client.get("/api/v1/config").json()
    res = client.post("/api/v1/recommend", json={"strategy": "frequency_hot", "seed": 3})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["count"] == cfg["lotto_number_recommendation_count"]
    assert body["target_draw_no"] >= 1001
    assert [s["strategy"] for s in body["sets"]] == ["frequency_hot", "uniform"]
    for st in body["sets"]:
        assert len(st["tickets"]) == body["count"]
        card = st["tickets"][0]["scorecard"]
        assert len(card["per_number"]) == 6 and len(card["pairs"]) == 15
        assert abs(sum(card["match_distribution"].values()) - 1) < 1e-9
        assert card["typicality"]["typicality_p"] is not None
    hist = client.get("/api/v1/recommend/history?limit=5").json()
    assert hist and hist[0]["strategy"] in ("frequency_hot", "uniform")
    cats = client.get("/api/v1/recommend/strategies").json()
    assert len(cats) == 9
    bad = client.post("/api/v1/recommend", json={"strategy": "nope"})
    assert bad.status_code == 400


def test_user_ticket_evaluate_save_and_tracking(seeded: None, client) -> None:  # noqa: ANN001
    ev = client.post("/api/v1/user/tickets/evaluate", json={"numbers": [1, 2, 3, 4, 5, 6]})
    assert ev.status_code == 200 and ev.json()["typicality"]["features"]["consecutive_pairs"] == 5
    dup = client.post("/api/v1/user/tickets/evaluate", json={"numbers": [1, 2, 3, 4, 5, 6], "bonus": 6})
    assert dup.status_code == 400
    # 저장 → 대상 회차 = 다음 회차; 그 회차를 입력하면 자동 대조
    summary = client.get("/api/v1/data/summary").json()
    target = summary["max_draw"] + 1
    saved = client.post("/api/v1/user/tickets", json={"numbers": [3, 9, 14, 22, 37, 44], "label": "t"}).json()
    assert saved["target_draw_no"] == target
    pend = client.get("/api/v1/tracking/pending").json()
    assert pend["user_tickets"] >= 1 and target in pend["target_draws"]
    # 대상 회차 결과 입력: 3개 일치 → 5등
    ins = client.post("/api/v1/data/draws", json={"draw_no": target, "numbers": [3, 9, 14, 20, 30, 40], "bonus": 1})
    assert ins.status_code == 200 and ins.json()["inserted"] == 1
    lst = client.get("/api/v1/user/tickets").json()
    mine = next(u for u in lst if u["ticket_id"] == saved["ticket_id"])
    assert mine["outcomes"] and mine["outcomes"][0]["main_matches"] == 3 and mine["outcomes"][0]["rank"] == 5
    assert mine["outcomes"][0]["prize_amount"] == 5000
    ts = client.get("/api/v1/tracking/summary?origin=user").json()
    assert "user" in ts["strategies"] and ts["strategies"]["user"]["n_tickets"] >= 1
    oc = client.get("/api/v1/tracking/outcomes?source=user").json()
    assert oc and oc[0]["rank"] in range(0, 6)


def test_rank_and_prize_rules() -> None:
    from app.core.config import settings
    from app.db.models import Draw
    from app.services.tracking_service import evaluate_ticket, rank_of

    assert rank_of(6, False) == 1 and rank_of(5, True) == 2 and rank_of(5, False) == 3
    assert rank_of(4, True) == 4 and rank_of(3, False) == 5 and rank_of(2, True) == 0
    d = Draw(draw_no=1, n1=1, n2=2, n3=3, n4=4, n5=5, n6=6, bonus=7, prize1=2_000_000_000, prize2=50_000_000)
    assert evaluate_ticket([1, 2, 3, 4, 5, 6], d) == (6, False, 1, 2_000_000_000)
    assert evaluate_ticket([1, 2, 3, 4, 5, 7], d) == (5, True, 2, 50_000_000)
    assert evaluate_ticket([1, 2, 3, 4, 5, 8], d)[3] == settings.lotto_prize_rank3_default


def test_validation_replay_small_range(seeded: None, client) -> None:  # noqa: ANN001
    """1001~1012 replay: 전략 3개 × 4장. 군 B 실데이터 사용, look-ahead 금지, 결과 요약·재현성·동질성."""
    body = {"strategies": ["uniform", "frequency_hot", "low_competition"], "tickets_per_draw": 4,
            "from_draw": 1001, "to_draw": 1012, "seed": 11, "insert_draws": False, "sync": True}
    res = client.post("/api/v1/validation/runs", json=body)
    assert res.status_code == 200, res.text
    v = res.json()
    assert v["status"] == "done", v
    vid = v["validation_id"]
    meta = client.get(f"/api/v1/validation/runs/{vid}/meta").json()
    assert meta["n_draws_b"] == 12 and meta["to_draw"] == 1012
    bt = client.get(f"/api/v1/validation/runs/{vid}/backtest").json()
    u = bt["strategies"]["uniform"]
    assert u["n_tickets"] == 48 and sum(u["match_hist"]) == 48 and u["expected_matches"] == pytest.approx(0.8)
    assert "frequency_hot" in bt["comparison_vs_uniform"]
    sc = client.get(f"/api/v1/validation/runs/{vid}/scoring").json()
    assert "brier_diff_vs_uniform" in sc["frequency_hot"]
    rep = client.get(f"/api/v1/validation/runs/{vid}/replication").json()
    assert rep["T_b"] == 12 and "pairs" in rep and "numbers" in rep
    hom = client.get(f"/api/v1/validation/runs/{vid}/homogeneity").json()
    assert hom["df"] == 44
    # backtest outcome 이 tracking 에 origin=backtest 로 기록
    ts = client.get("/api/v1/tracking/summary?origin=backtest").json()
    assert ts["strategies"]["uniform"]["n_tickets"] == 48
    latest = client.get("/api/v1/validation/runs/latest").json()
    assert latest["validation_id"] == vid
