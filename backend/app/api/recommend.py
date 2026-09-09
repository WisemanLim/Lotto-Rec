"""추천 API (PRD §E4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.base import get_session
from app.services import recommend_service as rsvc

router = APIRouter(prefix="/recommend", tags=["recommend"])


class RecommendIn(BaseModel):
    strategy: str = Field("hybrid")
    count: int | None = Field(None, ge=1, le=50, description="미지정 시 LOTTO_NUMBER_RECOMMENDATION_COUNT")
    seed: int | None = None
    max_shared: int | None = Field(None, ge=0, le=6, description="티켓 간 최대 공유 번호(커버리지)")
    include_control: bool = True
    save: bool = True


@router.get("/strategies")
def strategies() -> list[dict]:
    return rsvc.strategy_catalog()


@router.post("")
def recommend(body: RecommendIn, session: Session = Depends(get_session)) -> dict:
    try:
        return rsvc.recommend(
            session,
            strategy=body.strategy,
            count=body.count,
            seed=body.seed,
            max_shared=body.max_shared,
            include_control=body.include_control,
            save=body.save,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


class AutoRegisterIn(BaseModel):
    target_draw_no: int | None = Field(None, ge=1, description="미지정 시 최신 회차 + 1")
    seed: int | None = Field(None, ge=0, description="미지정 시 무작위(응답에 사용 seed 포함)")


@router.post("/auto-register")
def auto_register(body: AutoRegisterIn, session: Session = Depends(get_session)) -> dict:
    """S4.10 — 1..P 중 5개 무작위 추출을 대상 회차 수만큼 반복 → 빈도 상위 5 위치 → 전략별 최신 batch 티켓 등록."""
    return rsvc.auto_register(session, target_draw_no=body.target_draw_no, seed=body.seed)


@router.get("/history")
def history(
    limit: int = Query(200, ge=1, le=50000, description="표시 개수 (전체 = 50000)"),
    offset: int = Query(0, ge=0),
    strategy: str | None = None,
    batch_id: str | None = None,
    target_draw_no: int | None = Query(None, ge=1),
    origin: str = Query("user", pattern="^(user|backtest|all)$", description="출처: 사용자 생성 | 검증 replay | 전체"),
    session: Session = Depends(get_session),
) -> list[dict]:
    return rsvc.list_recommendations(
        session,
        limit=limit,
        offset=offset,
        origin=origin,
        strategy=strategy,
        batch_id=batch_id,
        target_draw_no=target_draw_no,
    )


@router.get("/history/summary")
def history_summary(
    strategy: str | None = None,
    batch_id: str | None = None,
    target_draw_no: int | None = Query(None, ge=1),
    origin: str = Query("user", pattern="^(user|backtest|all)$"),
    session: Session = Depends(get_session),
) -> dict:
    """필터 적용 건수·전략별 건수·대상 회차/batch 목록 (PRD S4.6)."""
    return rsvc.history_summary(
        session, origin=origin, strategy=strategy, batch_id=batch_id, target_draw_no=target_draw_no
    )
