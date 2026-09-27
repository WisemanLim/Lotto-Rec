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


def test_auto_register_rejected_for_completed_draw(seeded: None, client) -> None:  # noqa: ANN001
    """v1.19: 결과가 입력된 회차(≤ 최신 결과 회차)는 자동 등록 거부(400)."""
    latest = client.get("/api/v1/user/tickets/draws").json()["latest_result_draw"]
    for t in (1, latest):
        r = client.post("/api/v1/recommend/auto-register", json={"target_draw_no": t, "seed": 1})
        assert r.status_code == 400 and "결과가 입력된 회차" in r.json()["detail"]


def test_auto_register_excludes_tickets_with_excluded_numbers(seeded: None, client, session, monkeypatch) -> None:  # noqa: ANN001
    """v1.28 — exclude_numbers 가 포함된 (전략, 위치) 조합은 등록하지 않는다(대체 없이 skip)."""
    from app.core.config import settings
    from app.db.models import Recommendation

    monkeypatch.setattr(settings, "lotto_number_recommendation_count", 1)  # pool=1 → 선택 위치는 항상 1
    target = client.get("/api/v1/data/summary").json()["max_draw"] + 1

    rec1 = Recommendation(
        batch_id="exc-1", strategy="uniform", seed=1, ticket=[1, 2, 3, 4, 5, 6], target_draw_no=target, origin="user"
    )
    session.add(rec1)
    session.commit()
    r1 = client.post("/api/v1/recommend/auto-register", json={"seed": 1})
    assert r1.status_code == 200
    s1 = next(s for s in r1.json()["strategies"] if s["strategy"] == "uniform")
    assert len(s1["registered"]) == 1 and s1["excluded_positions"] == []

    rec2 = Recommendation(
        batch_id="exc-2", strategy="uniform", seed=1, ticket=[7, 8, 9, 10, 11, 12], target_draw_no=target, origin="user"
    )
    session.add(rec2)
    session.commit()
    r2 = client.post("/api/v1/recommend/auto-register", json={"seed": 1, "exclude_numbers": [9]})
    assert r2.status_code == 200
    body = r2.json()
    assert body["exclude_numbers"] == [9]
    s2 = next(s for s in body["strategies"] if s["strategy"] == "uniform")
    assert s2["batch_id"] == "exc-2"  # 최신 batch
    assert s2["registered"] == [] and s2["missing_positions"] == []
    assert s2["excluded_positions"] == [{"position": 1, "rec_id": rec2.rec_id, "ticket": [7, 8, 9, 10, 11, 12]}]
    after = client.get(f"/api/v1/user/tickets?target_draw_no={target}").json()
    assert not any(t["numbers"] == [7, 8, 9, 10, 11, 12] for t in after)  # 제외된 티켓은 저장되지 않음

    # 제외 번호가 없는(포함 안 된) 값이면 정상 등록
    r3 = client.post("/api/v1/recommend/auto-register", json={"seed": 1, "exclude_numbers": [44, 45]})
    s3 = next(s for s in r3.json()["strategies"] if s["strategy"] == "uniform")
    assert len(s3["registered"]) == 1 and s3["excluded_positions"] == []


def test_auto_register_exclude_numbers_out_of_range_422(seeded: None, client) -> None:  # noqa: ANN001
    assert client.post("/api/v1/recommend/auto-register", json={"exclude_numbers": [0]}).status_code == 422
    assert client.post("/api/v1/recommend/auto-register", json={"exclude_numbers": [46]}).status_code == 422
