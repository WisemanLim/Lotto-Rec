"""S4.10 — 내 번호로 자동 등록: 무작위 빈도 상위 5 위치 → 전략별 최신 batch 티켓 등록, 중복은 병합(S5.6)."""

from __future__ import annotations


def test_auto_register_selects_and_registers(seeded: None, client, monkeypatch) -> None:  # noqa: ANN001
    # 풀 크기는 .env.local 값에 따라 달라지므로 테스트에서는 10 으로 고정
    from app.core.config import settings

    monkeypatch.setattr(settings, "lotto_number_recommendation_count", 10)
    target = client.get("/api/v1/data/summary").json()["max_draw"] + 1
    r = client.post("/api/v1/recommend", json={"strategy": "frequency_hot", "count": 10, "seed": 5})
    assert r.status_code == 200, r.text
    batch = r.json()["batch_id"]
    before = len(client.get("/api/v1/user/tickets?limit=2000").json())

    res = client.post("/api/v1/recommend/auto-register", json={"seed": 42})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["target_draw_no"] == target and body["rounds"] == target
    assert body["pool"] == 10 and body["pick"] == 5 and body["seed"] == 42
    assert len(body["selected"]) == 5 and body["selected"] == sorted(body["selected"])
    assert all(1 <= n <= 10 for n in body["selected"])
    assert sum(body["counts"].values()) == target * 5
    # 빈도 상위 5 = selected (동률은 작은 번호)
    order = sorted(range(1, 11), key=lambda n: (-body["counts"][str(n)], n))
    assert sorted(order[:5]) == body["selected"]

    strategies = {s["strategy"]: s for s in body["strategies"]}
    assert {"frequency_hot", "uniform"} <= set(strategies)
    for s in strategies.values():
        if s["batch_id"] == batch:
            assert s["n_tickets"] == 10 and [x["position"] for x in s["registered"]] == body["selected"]
            assert s["missing_positions"] == []
    hot = strategies["frequency_hot"]
    assert hot["batch_id"] == batch  # 최신 batch
    assert all(x["ticket_id"] for x in hot["registered"])
    after = client.get("/api/v1/user/tickets?limit=2000").json()
    assert len(after) == before + body["total_registered"]
    assert any(t["label"].startswith("추천 ") and t["target_draw_no"] == target for t in after)

    # 같은 seed 재실행 → 같은 선택, 전부 병합(★ dup_count=2), 행 수 불변 (S5.6)
    res2 = client.post("/api/v1/recommend/auto-register", json={"seed": 42}).json()
    assert res2["selected"] == body["selected"]
    assert res2["total_registered"] == 0 and res2["total_merged"] == body["total_registered"]
    merged = [m for s in res2["strategies"] for m in s["merged_duplicates"]]
    assert merged and all(m["dup_count"] >= 2 and m["ticket_id"] for m in merged)
    after2 = client.get("/api/v1/user/tickets?limit=2000").json()
    assert len(after2) == len(after)
    assert any(t["dup_count"] >= 2 and t["duplicate"] for t in after2)

    # seed 미지정 → 응답에 seed 포함
    res3 = client.post("/api/v1/recommend/auto-register", json={}).json()
    assert isinstance(res3["seed"], int) and len(res3["selected"]) == 5
