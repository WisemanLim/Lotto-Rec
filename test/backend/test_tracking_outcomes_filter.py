"""S8.6 — 티켓 단위 결과 필터·offset·summary."""

from __future__ import annotations


def test_outcomes_filters_offset_and_summary(seeded: None, client) -> None:  # noqa: ANN001
    client.post("/api/v1/validation/runs", json={"strategies": ["uniform", "frequency_hot"], "tickets_per_draw": 3,
                                                 "from_draw": 1001, "to_draw": 1005, "seed": 4, "insert_draws": False, "sync": True})
    s_all = client.get("/api/v1/tracking/outcomes/summary?origin=backtest").json()
    assert s_all["total_all"] == 30 and s_all["total_filtered"] == 30
    assert s_all["draw_nos"] == [1005, 1004, 1003, 1002, 1001]
    assert s_all["strategies"] == {"uniform": 15, "frequency_hot": 15} and s_all["by_source"] == {"recommendation": 30}
    assert "backtest" in s_all["by_origin"]
    s_f = client.get("/api/v1/tracking/outcomes/summary?origin=backtest&draw_no=1003&strategy=uniform").json()
    assert s_f["total_filtered"] == 3 and s_f["total_all"] == 30
    rows = client.get("/api/v1/tracking/outcomes?origin=backtest&draw_no=1003&limit=50000").json()
    assert len(rows) == 6 and all(r["draw_no"] == 1003 for r in rows)
    ids: list[int] = []
    for off in range(0, 30, 7):
        page = client.get(f"/api/v1/tracking/outcomes?origin=backtest&limit=7&offset={off}").json()
        ids.extend(r["outcome_id"] for r in page)
    assert len(ids) == 30 and len(set(ids)) == 30
    assert client.get("/api/v1/tracking/outcomes?limit=60000").status_code == 422
    assert client.get("/api/v1/tracking/outcomes?source=nope").status_code == 422
