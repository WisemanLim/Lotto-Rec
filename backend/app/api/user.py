"""사용자 번호 API (PRD §E5)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import to_iso
from app.db.base import get_session
from app.db.models import TicketOutcome, UserTicket
from app.services import recommend_service as rsvc

router = APIRouter(prefix="/user", tags=["user"])


class TicketIn(BaseModel):
    numbers: list[int] = Field(min_length=6, max_length=6)
    bonus: int | None = Field(None, ge=1, le=45)
    label: str | None = Field(None, max_length=64)
    target_draw_no: int | None = Field(None, ge=1)

    @field_validator("numbers")
    @classmethod
    def _v(cls, v: list[int]) -> list[int]:
        if len(set(v)) != 6 or any(not (1 <= x <= 45) for x in v):
            raise ValueError("1~45 범위의 서로 다른 6개")
        return sorted(v)


@router.post("/tickets/evaluate")
def evaluate(body: TicketIn, session: Session = Depends(get_session)) -> dict:
    if body.bonus is not None and body.bonus in body.numbers:
        raise HTTPException(400, "보너스가 본번호와 중복")
    return rsvc.evaluate_user_ticket(session, body.numbers, body.bonus)


@router.post("/tickets")
def save(body: TicketIn, session: Session = Depends(get_session)) -> dict:
    ut = rsvc.save_user_ticket(session, body.numbers, body.bonus, body.label, body.target_draw_no)
    return _out(ut, session)


@router.get("/tickets")
def list_tickets(limit: int = Query(200, ge=1, le=2000), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(UserTicket).order_by(UserTicket.ticket_id.desc()).limit(limit)).all()
    return [_out(u, session) for u in rows]


@router.delete("/tickets/{ticket_id}")
def delete(ticket_id: int, session: Session = Depends(get_session)) -> dict:
    u = session.get(UserTicket, ticket_id)
    if u is None:
        raise HTTPException(404, "없음")
    session.delete(u)
    session.commit()
    return {"deleted": ticket_id}


def _out(u: UserTicket, session: Session) -> dict:
    oc = session.scalars(
        select(TicketOutcome).where(TicketOutcome.source == "user", TicketOutcome.ticket_ref == u.ticket_id)
    ).all()
    return {
        "ticket_id": u.ticket_id,
        "numbers": u.numbers,
        "bonus": u.bonus,
        "label": u.label,
        "target_draw_no": u.target_draw_no,
        "scorecard": u.scorecard,
        "created_at": to_iso(u.created_at),
        "outcomes": [
            {
                "draw_no": o.draw_no,
                "main_matches": o.main_matches,
                "bonus_match": o.bonus_match,
                "rank": o.rank,
                "prize_amount": o.prize_amount,
            }
            for o in oc
        ],
    }
