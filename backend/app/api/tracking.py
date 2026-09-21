"""성과 추적 API (PRD §E8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.base import get_session
from app.services import tracking_service as tsvc

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.get("/summary")
def summary(
    origin: str | None = Query(None, pattern="^(user|backtest)$"), session: Session = Depends(get_session)
) -> dict:
    return tsvc.tracking_summary(session, origin)


@router.get("/outcomes")
def outcomes(
    strategy: str | None = None,
    draw_no: int | None = Query(None, ge=1),
    source: str | None = Query(None, pattern="^(recommendation|user)$"),
    origin: str | None = Query(None, pattern="^(user|backtest|all)$"),
    limit: int = Query(500, ge=1, le=50000, description="표시 개수 (전체 = 50000)"),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
) -> list[dict]:
    return tsvc.outcomes(
        session, strategy=strategy, draw_no=draw_no, source=source, origin=origin, limit=limit, offset=offset
    )


@router.get("/outcomes/summary")
def outcomes_summary(
    strategy: str | None = None,
    draw_no: int | None = Query(None, ge=1),
    source: str | None = Query(None, pattern="^(recommendation|user)$"),
    origin: str | None = Query(None, pattern="^(user|backtest|all)$"),
    session: Session = Depends(get_session),
) -> dict:
    """필터 건수·회차/전략 목록·출처별 건수 (PRD S8.6)."""
    return tsvc.outcomes_summary(session, strategy=strategy, draw_no=draw_no, source=source, origin=origin)


@router.get("/consistency")
def consistency(
    origin: str = Query("user", pattern="^(user|backtest|all)$"),
    source: str = Query("recommendation", pattern="^(recommendation|user|all)$"),
    strategy: str | None = None,
    session: Session = Depends(get_session),
) -> dict:
    """S8.7 추천 정합성 분석 — 등수 분포·일치수 GOF·번호 상관·번호쌍 상관 (BH 보정)."""
    return tsvc.recommendation_consistency(session, origin=origin, source=source, strategy=strategy)


@router.get("/pending")
def pending(session: Session = Depends(get_session)) -> dict:
    return tsvc.pending_tickets(session)


@router.post("/evaluate/{draw_no}")
def evaluate(draw_no: int, session: Session = Depends(get_session)) -> dict:
    n = tsvc.evaluate_draw(session, draw_no)
    session.commit()
    return {"draw_no": draw_no, "evaluated": n}
