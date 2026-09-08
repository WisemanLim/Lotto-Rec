"""S4.6 — 추천 이력 필터·offset 페이징·요약 (전체 데이터 조회 가능)."""

from __future__ import annotations


def test_history_filters_offset_and_summary(seeded: None, client) -> None:  # noqa: ANN001
    # 3 배치 × (전략 + control) × 4장 = 24장 저장
    batches = []
    for s, seed in (("frequency_hot", 1), ("bayesian_shrink", 2), ("frequency_hot", 3)):
        r = client.post("/api/v1/recommend", json={"strategy": s, "count": 4, "seed": seed})
        assert r.status_code == 200, r.text
        batches.append(r.json()["batch_id"])
    summ = client.get("/api/v1/recommend/history/summary").json()
    assert summ["total_all"] >= 24 and summ["total_filtered"] == summ["total_all"]
    assert summ["by_strategy"]["frequency_hot"] >= 8 and summ["by_strategy"]["uniform"] >= 12
    assert batches[0] in {b["batch_id"] for b in summ["batches"]}
    assert summ["target_draws"] and summ["target_draws"] == sorted(summ["target_draws"], reverse=True)

    # 전략 필터
    hot = client.get("/api/v1/recommend/history?strategy=frequency_hot&limit=10000").json()
    assert len(hot) >= 8 and all(r["strategy"] == "frequency_hot" for r in hot)
    fs = client.get("/api/v1/recommend/history/summary?strategy=frequency_hot").json()
    assert fs["total_filtered"] == len(hot) and fs["total_all"] >= fs["total_filtered"]

    # batch 필터 = 8장 (전략 4 + control 4)
    b0 = client.get(f"/api/v1/recommend/history?batch_id={batches[0]}&limit=10000").json()
    assert len(b0) == 8 and {r["strategy"] for r in b0} == {"frequency_hot", "uniform"}

    # 대상 회차 필터
    td = summ["target_draws"][0]
    by_target = client.get(f"/api/v1/recommend/history?target_draw_no={td}&limit=10000").json()
    assert by_target and all(r["target_draw_no"] == td for r in by_target)

    # offset 페이징: 전체를 5개씩 이어 붙이면 동일 집합, 중복 없음
    total = summ["total_all"]
    ids: list[int] = []
    for off in range(0, total, 5):
        page = client.get(f"/api/v1/recommend/history?limit=5&offset={off}").json()
        assert len(page) <= 5
        ids.extend(r["rec_id"] for r in page)
    assert len(ids) == total and len(set(ids)) == total
    assert ids == sorted(ids, reverse=True)

    # 상한
    assert client.get("/api/v1/recommend/history?limit=60000").status_code == 422


def test_history_origin_filter(seeded: None, client) -> None:  # noqa: ANN001
    """origin=user(기본) | backtest | all — replay 티켓도 조회 가능."""
    client.post("/api/v1/validation/runs", json={"strategies": ["uniform"], "tickets_per_draw": 2, "from_draw": 1001,
                                                 "to_draw": 1004, "seed": 3, "insert_draws": False, "sync": True})
    client.post("/api/v1/recommend", json={"strategy": "uniform", "count": 2, "seed": 1, "include_control": False})
    su = client.get("/api/v1/recommend/history/summary").json()
    sb = client.get("/api/v1/recommend/history/summary?origin=backtest").json()
    sa = client.get("/api/v1/recommend/history/summary?origin=all").json()
    assert sb["total_all"] == 8 and sa["total_all"] == su["total_all"] + 8
    assert sa["by_origin"]["backtest"] == 8 and sa["by_origin"]["user"] == su["total_all"]
    rows = client.get("/api/v1/recommend/history?origin=all&limit=10000").json()
    assert len(rows) == sa["total_all"] and {r["origin"] for r in rows} == {"user", "backtest"}
    assert all(r["origin"] == "user" for r in client.get("/api/v1/recommend/history?limit=10000").json())
    assert client.get("/api/v1/recommend/history?origin=nope").status_code == 422
