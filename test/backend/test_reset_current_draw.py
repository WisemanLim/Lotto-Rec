"""S4.12 추천 초기화 · S5.9 내 번호 초기화 (v1.15)."""

from __future__ import annotations

from sqlalchemy import delete, func, select

from app.db.models import Recommendation, TicketOutcome, UserTicket


def _clean(session) -> None:  # noqa: ANN001
    session.execute(delete(UserTicket))
    session.execute(delete(TicketOutcome))
    session.execute(delete(Recommendation).where(Recommendation.origin == "user"))
    session.commit()


def _count(session, model, *where):  # noqa: ANN001, ANN202
    return session.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_reset_recommendations_only_current_draw_user_origin(seeded: None, client, session) -> None:  # noqa: ANN001
    _clean(session)
    nxt = client.get("/api/v1/user/tickets/draws").json()["next_draw"]
    body = {"strategy": "uniform", "count": 3, "include_control": False}
    assert client.post("/api/v1/recommend", json=body).status_code == 200  # 현재 회차(nxt)
    other = Recommendation(
        batch_id="b-old", strategy="uniform", seed=1, ticket=[1, 2, 3, 4, 5, 6], target_draw_no=nxt - 1, origin="user"
    )
    bt = Recommendation(
        batch_id="b-bt", strategy="uniform", seed=1, ticket=[1, 2, 3, 4, 5, 7], target_draw_no=nxt, origin="backtest"
    )
    session.add_all([other, bt])
    session.commit()
    bt_id = bt.rec_id

    r = client.delete("/api/v1/recommend/history")
    assert r.status_code == 200
    assert r.json() == {"target_draw_no": nxt, "deleted_recommendations": 3, "deleted_outcomes": 0}
    session.expire_all()
    assert _count(session, Recommendation, Recommendation.target_draw_no == nxt, Recommendation.origin == "user") == 0
    prev = (Recommendation.target_draw_no == nxt - 1, Recommendation.origin == "user")
    assert _count(session, Recommendation, *prev) == 1
    assert session.get(Recommendation, bt_id) is not None  # backtest 보존
    # 재호출은 0건(멱등)
    assert client.delete("/api/v1/recommend/history").json()["deleted_recommendations"] == 0
    _clean(session)
    session.execute(delete(Recommendation).where(Recommendation.batch_id.in_(["b-bt"])))
    session.commit()


def test_reset_recommendations_rejected_for_completed_draw(seeded: None, client, session) -> None:  # noqa: ANN001
    """v1.19: 결과가 입력된 회차(≤ 최신 결과 회차)의 추천·성과 결과는 초기화 거부(400), 데이터 보존."""
    _clean(session)
    rec = Recommendation(
        batch_id="b-x", strategy="uniform", seed=1, ticket=[1, 2, 3, 4, 5, 6], target_draw_no=5, origin="user"
    )
    session.add(rec)
    session.commit()
    session.add(
        TicketOutcome(
            source="recommendation", ticket_ref=rec.rec_id, strategy="uniform", origin="user", draw_no=5,
            ticket=[1, 2, 3, 4, 5, 6], main_matches=0, rank=0,
        )
    )
    session.commit()
    latest = client.get("/api/v1/user/tickets/draws").json()["latest_result_draw"]
    for t in (5, latest):
        r = client.delete(f"/api/v1/recommend/history?target_draw_no={t}")
        assert r.status_code == 400 and "결과가 입력된 회차" in r.json()["detail"]
    session.expire_all()
    assert _count(session, Recommendation, Recommendation.rec_id == rec.rec_id) == 1
    assert _count(session, TicketOutcome) == 1
    ok = client.delete(f"/api/v1/recommend/history?target_draw_no={latest + 1}")  # 진행 예정은 허용
    assert ok.status_code == 200
    _clean(session)


def test_reset_tickets_by_draw(seeded: None, client, session) -> None:  # noqa: ANN001
    _clean(session)
    nxt = client.get("/api/v1/user/tickets/draws").json()["next_draw"]
    client.post("/api/v1/user/tickets", json={"numbers": [1, 2, 3, 4, 5, 6], "target_draw_no": nxt})
    client.post("/api/v1/user/tickets", json={"numbers": [7, 8, 9, 10, 11, 12], "target_draw_no": nxt})
    client.post("/api/v1/user/tickets", json={"numbers": [1, 2, 3, 4, 5, 6], "target_draw_no": nxt - 1})

    assert client.delete("/api/v1/user/tickets").status_code == 422  # target_draw_no 필수
    done = client.delete(f"/api/v1/user/tickets?target_draw_no={nxt - 1}")  # 결과 입력된 회차 → 거부
    assert done.status_code == 400 and "결과가 입력된 회차" in done.json()["detail"]
    r = client.delete(f"/api/v1/user/tickets?target_draw_no={nxt}")
    assert r.json() == {"target_draw_no": nxt, "deleted_tickets": 2, "deleted_outcomes": 0}
    assert client.get(f"/api/v1/user/tickets?target_draw_no={nxt}").json() == []
    assert len(client.get(f"/api/v1/user/tickets?target_draw_no={nxt - 1}").json()) == 1  # 다른 회차 유지
    _clean(session)
