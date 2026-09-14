"""S5.7 (v1.11) — 저장된 번호의 현재 대상 회차 전환 규칙·회차 필터."""

from __future__ import annotations

from sqlalchemy import delete

from app.db.models import Recommendation, UserTicket


def _reset(session) -> None:  # noqa: ANN001
    session.execute(delete(UserTicket))
    session.execute(delete(Recommendation).where(Recommendation.origin == "user"))
    session.commit()


def test_active_draw_switches_only_after_next_recommendation_saved(seeded: None, client, session) -> None:  # noqa: ANN001
    """결과 회차 R(=DB 최대 회차): 내 번호(대상 R)만 있으면 active=R(낙첨 확인), R+1 추천 저장 후 active=R+1."""
    _reset(session)
    ctx = client.get("/api/v1/user/tickets/draws").json()
    R, nxt = ctx["latest_result_draw"], ctx["next_draw"]
    assert R >= 1000 and nxt == R + 1  # 다른 테스트가 회차를 추가해도 상대 규칙은 동일
    assert ctx["active_target_draw"] == nxt and ctx["reason"] == "none" and ctx["draws"] == []

    # 결과가 등록된 회차(R)를 대상으로 저장된 내 번호 → 아직 다음 회차 추천 없음 → R 유지
    r = client.post("/api/v1/user/tickets", json={"numbers": [1, 2, 3, 4, 5, 6], "target_draw_no": R})
    assert r.status_code == 200
    ctx = client.get("/api/v1/user/tickets/draws").json()
    assert ctx["active_target_draw"] == R and ctx["reason"] == "awaiting_next_recommendation"
    assert ctx["draws"] == [{"target_draw_no": R, "count": 1, "evaluated": True}]

    # 추천 생성(save=False) 은 전환 안 함
    body = {"strategy": "uniform", "count": 2, "save": False, "include_control": False}
    r = client.post("/api/v1/recommend", json=body)
    assert r.status_code == 200 and r.json()["target_draw_no"] == nxt
    assert client.get("/api/v1/user/tickets/draws").json()["active_target_draw"] == R

    # 다음 회차(R+1) 추천 저장 → 전환
    r = client.post("/api/v1/recommend", json={**body, "save": True})
    assert r.status_code == 200
    ctx = client.get("/api/v1/user/tickets/draws").json()
    assert ctx["active_target_draw"] == nxt and ctx["reason"] == "next_recommended"
    assert ctx["draws"] == [{"target_draw_no": R, "count": 1, "evaluated": True}]  # R+1 내 번호는 아직 없음

    # 회차 필터: R+1 은 비어 있고(삭제 아님), R 은 1건, 전체는 1건
    assert client.get(f"/api/v1/user/tickets?target_draw_no={nxt}").json() == []
    assert len(client.get(f"/api/v1/user/tickets?target_draw_no={R}").json()) == 1
    assert len(client.get("/api/v1/user/tickets").json()) == 1


def test_active_draw_next_registered_without_recommendation(seeded: None, client, session) -> None:  # noqa: ANN001
    """다음 회차 내 번호를 직접 등록해도 전환(reason=next_registered)."""
    _reset(session)
    nxt = client.get("/api/v1/user/tickets/draws").json()["next_draw"]
    client.post("/api/v1/user/tickets", json={"numbers": [7, 8, 9, 10, 11, 12], "target_draw_no": 999})
    client.post("/api/v1/user/tickets", json={"numbers": [1, 2, 3, 4, 5, 6], "target_draw_no": nxt})
    ctx = client.get("/api/v1/user/tickets/draws").json()
    assert ctx["active_target_draw"] == nxt and ctx["reason"] == "next_registered"
    assert ctx["draws"] == [
        {"target_draw_no": nxt, "count": 1, "evaluated": False},
        {"target_draw_no": 999, "count": 1, "evaluated": True},
    ]
    assert len(client.get("/api/v1/user/tickets?target_draw_no=999").json()) == 1
    _reset(session)
