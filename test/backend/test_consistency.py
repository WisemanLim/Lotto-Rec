"""S8.7 (v1.16) — 추천 정합성 분석: 순수 계산 + API."""

from __future__ import annotations

import numpy as np
from sqlalchemy import delete

from app.core.consistency import analyze
from app.db.models import Draw, Recommendation, TicketOutcome
from app.services.tracking_service import evaluate_ticket


def _sim(rng, n_draws: int, per_draw: int, *, cheat: bool):  # noqa: ANN001, ANN202
    """균등 무작위 추첨·티켓. cheat=True 면 티켓이 당첨번호 4~5개를 포함(누설) — 정합성 분석이 잡아내야 함."""
    winners: dict[int, set[int]] = {}
    rows = []
    for d in range(1, n_draws + 1):
        w = set(rng.choice(np.arange(1, 46), 6, replace=False).tolist())
        winners[d] = w
        for _ in range(per_draw):
            if cheat:
                keep = rng.choice(sorted(w), 4, replace=False).tolist()
                rest = [x for x in range(1, 46) if x not in w]
                t = sorted(keep + rng.choice(rest, 2, replace=False).tolist())
            else:
                t = sorted(rng.choice(np.arange(1, 46), 6, replace=False).tolist())
            m = len(set(t) & w)
            rank = {6: 1, 5: 3, 4: 4, 3: 5}.get(m, 0)
            rows.append((d, t, m, rank))
    return rows, winners


def test_uniform_random_tickets_are_consistent() -> None:
    rng = np.random.default_rng(7)
    rows, winners = _sim(rng, 120, 10, cheat=False)
    res = analyze({"uniform": rows}, winners, alpha=0.01)
    s = res["strategies"]["uniform"]
    assert s["verdict"] == "consistent" and s["n_draws"] == 120 and s["n_tickets"] == 1200
    assert 0 <= s["match_gof"]["p"] <= 1
    assert abs(s["number_corr"]["mean_r"]) < 0.1
    assert res["feedback"]["n_deviation"] == 0 and res["feedback"]["next_experiment"] == []
    assert sum(r["observed"] for r in s["rank_dist"]) == 1200


def test_leaky_strategy_is_flagged_with_next_experiment() -> None:
    rng = np.random.default_rng(11)
    rows, winners = _sim(rng, 60, 10, cheat=True)
    res = analyze({"hybrid": rows}, winners, alpha=0.05, latest_draw=60)
    s = res["strategies"]["hybrid"]
    assert s["verdict"] == "deviation" and s["min_q"] < 0.05
    assert s["number_corr"]["mean_r"] > 0.3 and s["number_corr"]["p"] < 1e-6
    assert s["pair_corr"]["mean_excess_rate"] > 0 and s["pair_corr"]["p"] < 1e-6
    assert res["feedback"]["next_experiment"] == [
        {"strategy": "hybrid", "tune_to": 60, "note": "튠 구간 끝을 최신 회차로 확장한 실험 실행(E9)"}
    ]


def test_uniform_deviation_points_to_data_not_strategy() -> None:
    rng = np.random.default_rng(3)
    rows, winners = _sim(rng, 60, 10, cheat=True)
    res = analyze({"uniform": rows}, winners)
    assert res["feedback"]["next_experiment"] == [] and "control" in res["feedback"]["actions"][0]


def test_too_few_draws_is_insufficient() -> None:
    rng = np.random.default_rng(1)
    rows, winners = _sim(rng, 3, 10, cheat=False)
    res = analyze({"uniform": rows}, winners)
    assert res["strategies"]["uniform"]["verdict"] == "insufficient" and res["n_tests"] == 0
    assert "판정을 보류" in res["feedback"]["summary"]


def test_consistency_api_from_outcomes(seeded: None, client, session) -> None:  # noqa: ANN001
    session.execute(delete(TicketOutcome))
    session.execute(delete(Recommendation).where(Recommendation.origin == "user"))
    session.commit()
    rng = np.random.default_rng(5)
    for d in range(900, 912):
        draw = session.get(Draw, d)
        for _ in range(5):
            t = sorted(rng.choice(np.arange(1, 46), 6, replace=False).tolist())
            rec = Recommendation(
                batch_id=f"c{d}", strategy="uniform", seed=1, ticket=t, target_draw_no=d, origin="user"
            )
            session.add(rec)
            session.flush()
            m, b, r, prize = evaluate_ticket(t, draw)
            session.add(
                TicketOutcome(
                    source="recommendation", ticket_ref=rec.rec_id, strategy="uniform", origin="user", draw_no=d,
                    ticket=t, main_matches=m, bonus_match=b, rank=r, prize_amount=prize,
                )
            )
    session.commit()
    r = client.get("/api/v1/tracking/consistency?origin=user")
    assert r.status_code == 200
    body = r.json()
    u = body["strategies"]["uniform"]
    assert u["n_tickets"] == 60 and u["n_draws"] == 12 and body["source"] == "recommendation"
    assert [x["rank"] for x in u["rank_dist"]] == [0, 1, 2, 3, 4, 5]
    assert body["policy"]
    assert client.get("/api/v1/tracking/consistency?origin=backtest").json()["strategies"] == {}
    assert client.get("/api/v1/tracking/consistency?origin=bad").status_code == 422
    session.execute(delete(TicketOutcome))
    session.execute(delete(Recommendation).where(Recommendation.origin == "user"))
    session.commit()
