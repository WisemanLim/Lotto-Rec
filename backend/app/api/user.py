"""사용자 번호 API (PRD §E5)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import to_iso
from app.db.base import get_session
from app.db.models import Recommendation, TicketOutcome, UserTicket
from app.services import recommend_service as rsvc
from app.services.draws import max_draw_no

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
def list_tickets(
    limit: int = Query(200, ge=1, le=2000),
    target_draw_no: int | None = Query(None, ge=1, description="대상 회차 필터 (S5.7). 생략 = 전체"),
    session: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(UserTicket).order_by(UserTicket.ticket_id.desc()).limit(limit)
    if target_draw_no is not None:
        stmt = stmt.where(UserTicket.target_draw_no == target_draw_no)
    rows = session.scalars(stmt).all()
    same_map = _same_number_map(session)
    return [_out(u, session, same_map) for u in rows]


@router.get("/tickets/draws")
def ticket_draws(session: Session = Depends(get_session)) -> dict:
    """S5.7 현재 대상 회차 컨텍스트.

    R = 최신 결과 회차(DB 최대 회차), next = R+1.
    (a) next 대상 저장 추천(origin=user) 또는 next 대상 내 번호가 있으면 active = next
    (b) 아니면 저장된 내 번호의 최근 대상 회차 (결과 등록 직후 낙첨 확인 가능)
    (c) 내 번호 없음 → next
    """
    latest = max_draw_no(session) or 0
    nxt = latest + 1
    counts = session.execute(
        select(UserTicket.target_draw_no, func.count())
        .group_by(UserTicket.target_draw_no)
        .order_by(UserTicket.target_draw_no.desc())
    ).all()
    draws = [{"target_draw_no": int(d), "count": int(n), "evaluated": int(d) <= latest} for d, n in counts]
    has_next_ticket = any(d["target_draw_no"] == nxt for d in draws)
    has_next_rec = (
        session.scalar(
            select(func.count()).where(Recommendation.origin == "user", Recommendation.target_draw_no == nxt)
        )
        or 0
    ) > 0
    if has_next_rec or has_next_ticket:
        active, reason = nxt, ("next_recommended" if has_next_rec else "next_registered")
    elif draws:
        active, reason = draws[0]["target_draw_no"], "awaiting_next_recommendation"
    else:
        active, reason = nxt, "none"
    return {
        "next_draw": nxt,
        "latest_result_draw": latest,
        "active_target_draw": active,
        "reason": reason,
        "draws": draws,
    }


@router.delete("/tickets/{ticket_id}")
def delete(ticket_id: int, session: Session = Depends(get_session)) -> dict:
    u = session.get(UserTicket, ticket_id)
    if u is None:
        raise HTTPException(404, "없음")
    session.delete(u)
    session.commit()
    return {"deleted": ticket_id}


def _same_number_map(session: Session) -> dict[tuple[int, ...], list[int]]:
    """동일 6개 번호로 저장된 티켓 id 그룹 (S5.5)."""
    m: dict[tuple[int, ...], list[int]] = {}
    for tid, nums in session.execute(select(UserTicket.ticket_id, UserTicket.numbers)).all():
        m.setdefault(tuple(sorted(nums)), []).append(int(tid))
    return m


def _out(u: UserTicket, session: Session, same_map: dict[tuple[int, ...], list[int]] | None = None) -> dict:
    oc = session.scalars(
        select(TicketOutcome).where(TicketOutcome.source == "user", TicketOutcome.ticket_ref == u.ticket_id)
    ).all()
    same_map = same_map if same_map is not None else _same_number_map(session)
    others = [i for i in same_map.get(tuple(sorted(u.numbers)), []) if i != u.ticket_id]
    dup_count = int(u.dup_count or 1)
    return {
        "ticket_id": u.ticket_id,
        "numbers": u.numbers,
        "bonus": u.bonus,
        "label": u.label,
        "target_draw_no": u.target_draw_no,
        "scorecard": u.scorecard,
        "dup_count": dup_count,
        "dup_labels": list(u.dup_labels or []),
        "same_number_ticket_ids": others,
        "duplicate": dup_count > 1 or bool(others),
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
