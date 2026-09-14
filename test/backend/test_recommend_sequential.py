"""S4.11 (v1.12) — 추천 생성(순차): 모든 전략을 순서대로, 전략별 batch, control 미포함, 실패 계속."""

from __future__ import annotations


def test_sequential_runs_all_strategies_in_catalog_order(seeded: None, client) -> None:  # noqa: ANN001
    catalog = [s["id"] for s in client.get("/api/v1/recommend/strategies").json()]
    r = client.post("/api/v1/recommend/sequential", json={"count": 2, "seed": 7, "save": False})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["strategies"] == catalog and [x["sets"][0]["strategy"] for x in d["results"]] == catalog
    assert d["failed"] == [] and d["total_tickets"] == 2 * len(catalog)
    assert all(len(x["sets"]) == 1 and not x["sets"][0]["is_control"] for x in d["results"])
    assert len({x["batch_id"] for x in d["results"]}) == len(catalog)  # 전략별 별도 batch
    assert all(x["target_draw_no"] == d["target_draw_no"] and x["seed"] == 7 for x in d["results"])
    assert all(x["rec_id"] is None for res in d["results"] for x in res["sets"][0]["tickets"])  # 미저장


def test_sequential_saves_per_strategy_and_reports_failures(seeded: None, client) -> None:  # noqa: ANN001
    before = client.get("/api/v1/recommend/history/summary").json()["total_all"]
    body = {"strategies": ["uniform", "nope", "frequency_hot"], "count": 3, "save": True}
    d = client.post("/api/v1/recommend/sequential", json=body).json()
    assert [x["sets"][0]["strategy"] for x in d["results"]] == ["uniform", "frequency_hot"]
    assert d["failed"] == [{"strategy": "nope", "error": "알 수 없는 전략"}]
    assert d["total_tickets"] == 6
    after = client.get("/api/v1/recommend/history/summary").json()
    assert after["total_all"] == before + 6
    batches = {b["batch_id"] for b in after["batches"]}
    assert {x["batch_id"] for x in d["results"]} <= batches
    rows = client.get(f"/api/v1/recommend/history?batch_id={d['results'][1]['batch_id']}").json()
    assert len(rows) == 3 and {r["strategy"] for r in rows} == {"frequency_hot"}
