"""S1.6 (v1.16) — 1~5등 당첨게임 수·1게임당 당첨금 입력/저장/대조."""

from __future__ import annotations

from sqlalchemy import delete

from app.core.data_io import parse_draws, read_table
from app.db.models import Draw
from app.services.tracking_service import evaluate_ticket

BODY = {
    "draw_no": 9001,
    "numbers": [2, 4, 10, 16, 31, 41],
    "bonus": 9,
    "prize1": 3_281_029_250,
    "winners1": 9,
    "prize2": 47_322_538,
    "winners2": 104,
    "prize3": 1_535_105,
    "winners3": 3206,
    "prize4": 50_000,
    "winners4": 165_377,
    "prize5": 5_000,
    "winners5": 2_729_145,
}


def _cleanup(session) -> None:  # noqa: ANN001
    session.execute(delete(Draw).where(Draw.draw_no == 9001))
    session.commit()


def test_manual_entry_stores_and_returns_rank_3_to_5(seeded: None, client, session) -> None:  # noqa: ANN001
    _cleanup(session)
    try:
        r = client.post("/api/v1/data/draws", json=BODY)
        assert r.status_code == 200 and r.json()["inserted"] == 1
        d = client.get("/api/v1/data/draws/9001").json()
        for k in ("prize3", "winners3", "prize4", "winners4", "prize5", "winners5", "prize1", "winners2"):
            assert d[k] == BODY[k], k
    finally:
        _cleanup(session)


def test_entry_without_rank_3_to_5_stays_null(seeded: None, client, session) -> None:  # noqa: ANN001
    _cleanup(session)
    try:
        client.post("/api/v1/data/draws", json={k: BODY[k] for k in ("draw_no", "numbers", "bonus")})
        d = client.get("/api/v1/data/draws/9001").json()
        assert d["prize3"] is None and d["winners5"] is None
    finally:
        _cleanup(session)


def test_actual_prize_used_for_rank_3_to_5_else_default(seeded: None, client, session) -> None:  # noqa: ANN001
    _cleanup(session)
    try:
        client.post("/api/v1/data/draws", json=BODY)
        draw = session.get(Draw, 9001)
        # 본번호 5개 + 무관 보너스 → 3등 (실제 값), 4개 → 4등, 3개 → 5등
        assert evaluate_ticket([2, 4, 10, 16, 31, 45], draw)[2:] == (3, 1_535_105)
        assert evaluate_ticket([2, 4, 10, 16, 44, 45], draw)[2:] == (4, 50_000)
        assert evaluate_ticket([2, 4, 10, 43, 44, 45], draw)[2:] == (5, 5_000)
        draw.prize3 = None
        from app.core.config import settings

        assert evaluate_ticket([2, 4, 10, 16, 31, 45], draw)[3] == settings.lotto_prize_rank3_default
        session.rollback()
    finally:
        _cleanup(session)


def test_csv_columns_for_rank_3_to_5() -> None:
    csv = (
        "회차,n1,n2,n3,n4,n5,n6,보너스,3등 당첨금,3등 당첨수,4등 당첨금,4등 당첨수,5등 당첨금,5등 당첨수\n"
        "1,1,2,3,4,5,6,7,1500000,3000,50000,160000,5000,2700000\n"
    )
    rep = parse_draws(read_table(csv.encode(), "x.csv"))
    rec = rep.records[0]
    assert (rec.prize3, rec.winners3, rec.prize4, rec.winners4, rec.prize5, rec.winners5) == (
        1_500_000, 3000, 50_000, 160_000, 5_000, 2_700_000
    )
