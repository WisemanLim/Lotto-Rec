"""S4.9 — 추천 티켓이 과거 회차 1·2등 조합과 일치하면 past_wins 로 회차·등수를 돌려준다."""

from __future__ import annotations

from sqlalchemy import select

from app.db.models import Draw


def _draw(session, draw_no: int) -> Draw:  # noqa: ANN001
    return session.scalars(select(Draw).where(Draw.draw_no == draw_no)).one()


def test_index_first_second_and_none(seeded: None, session) -> None:  # noqa: ANN001
    from app.services.past_wins import PastWinIndex

    idx = PastWinIndex(session)
    d = _draw(session, 386)
    main = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]
    # 1등: 본번호 6개 동일 (입력 순서 무관)
    hits = idx.lookup(list(reversed(main)))
    assert {"draw_no": 386, "rank": 1} in hits
    # 2등: 본번호 5개 + 보너스
    second = main[1:] + [d.bonus]
    hits2 = idx.lookup(second)
    assert {"draw_no": 386, "rank": 2} in hits2
    assert all(h["rank"] in (1, 2) for h in hits2)
    # 불일치: 보너스가 아닌 번호로 교체
    other = next(n for n in range(1, 46) if n not in main and n != d.bonus)
    assert idx.lookup(main[1:] + [other]) == [] or all(h["draw_no"] != 386 for h in idx.lookup(main[1:] + [other]))
    # 결과는 회차 오름차순
    for hits_ in (hits, hits2):
        assert [h["draw_no"] for h in hits_] == sorted(h["draw_no"] for h in hits_)


def test_past_wins_in_recommend_history_and_outcomes(seeded: None, client) -> None:  # noqa: ANN001
    """추천 응답·이력·성과추적 outcomes 행마다 past_wins 리스트 포함."""
    r = client.post("/api/v1/recommend", json={"strategy": "uniform", "count": 3, "seed": 11, "include_control": False})
    assert r.status_code == 200, r.text
    tickets = r.json()["sets"][0]["tickets"]
    assert tickets and all(isinstance(t["past_wins"], list) for t in tickets)
    hist = client.get("/api/v1/recommend/history?limit=5").json()
    assert hist and all(isinstance(h["past_wins"], list) for h in hist)
    out = client.get("/api/v1/tracking/outcomes?limit=5").json()
    assert all(isinstance(o["past_wins"], list) for o in out)
