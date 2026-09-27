"""추천 API (PRD §E4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.db.base import get_session
from app.services import recommend_service as rsvc
from app.services import seed_search_service as ssvc

router = APIRouter(prefix="/recommend", tags=["recommend"])


def _check_exclude_range(v: list[int] | None) -> list[int] | None:
    """제외 번호 공용 검증(S4.10·S4.14) — 1~45 범위만 허용."""
    if v is not None and any(not (1 <= x <= 45) for x in v):
        raise ValueError("제외 번호는 1~45 범위")
    return v


class RecommendIn(BaseModel):
    strategy: str = Field("hybrid")
    count: int | None = Field(None, ge=1, le=200, description="미지정 시 LOTTO_NUMBER_RECOMMENDATION_COUNT")
    seed: int | None = None
    max_shared: int | None = Field(None, ge=0, le=6, description="티켓 간 최대 공유 번호(커버리지)")
    include_control: bool = True
    save: bool = True
    exclude_numbers: list[int] | None = Field(
        None, description="이 번호가 하나라도 포함된 조합은 생성하지 않음 (S4.14)"
    )

    _valid_exclude = field_validator("exclude_numbers")(_check_exclude_range)


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
            exclude_numbers=body.exclude_numbers,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


class SequentialIn(BaseModel):
    strategies: list[str] | None = Field(None, description="미지정 시 카탈로그 전체(순서대로)")
    count: int | None = Field(None, ge=1, le=200)
    seed: int | None = None
    max_shared: int | None = Field(None, ge=0, le=6)
    save: bool = True
    exclude_numbers: list[int] | None = Field(
        None, description="이 번호가 하나라도 포함된 조합은 생성하지 않음 (S4.14)"
    )

    _valid_exclude = field_validator("exclude_numbers")(_check_exclude_range)


@router.post("/sequential")
def recommend_sequential(body: SequentialIn, session: Session = Depends(get_session)) -> dict:
    """S4.11 — 전략 선택의 모든 전략을 순서대로 같은 옵션으로 생성 (전략별 batch, control 미포함)."""
    return rsvc.recommend_sequential(
        session,
        strategies=body.strategies,
        count=body.count,
        seed=body.seed,
        max_shared=body.max_shared,
        save=body.save,
        exclude_numbers=body.exclude_numbers,
    )


class AutoRegisterIn(BaseModel):
    target_draw_no: int | None = Field(None, ge=1, description="미지정 시 최신 회차 + 1")
    seed: int | None = Field(None, ge=0, description="미지정 시 무작위(응답에 사용 seed 포함)")
    exclude_numbers: list[int] | None = Field(
        None, description="이 번호가 하나라도 포함된 (전략, 위치) 조합은 등록하지 않음 (v1.28)"
    )

    _valid_exclude = field_validator("exclude_numbers")(_check_exclude_range)


@router.post("/auto-register")
def auto_register(body: AutoRegisterIn, session: Session = Depends(get_session)) -> dict:
    """S4.10 — 1..P 중 5개 무작위 추출을 대상 회차 수만큼 반복 → 빈도 상위 5 위치 → 전략별 최신 batch 티켓 등록."""
    try:
        return rsvc.auto_register(
            session, target_draw_no=body.target_draw_no, seed=body.seed, exclude_numbers=body.exclude_numbers
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


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


class SeedSearchIn(BaseModel):
    target_draw_no: int | None = Field(None, ge=1, description="미지정 시 최신 회차 + 1")
    target_rank: int = Field(1, ge=1, le=5, description="희망 등수 (1=6개 일치 … 5=3개 일치)")


@router.post("/seed-search")
def seed_search_start(body: SeedSearchIn, session: Session = Depends(get_session)) -> dict:
    """S4.13 — 대상 회차 직전 실제 회차 1등 번호를 기준으로 무작위 탐색 시작(백그라운드, 미저장)."""
    try:
        return ssvc.start_seed_search(session, target_draw_no=body.target_draw_no, target_rank=body.target_rank)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/seed-search/{job_id}")
def seed_search_status(job_id: str) -> dict:
    job = ssvc.get_job(job_id)
    if job is None:
        raise HTTPException(404, "탐색 작업을 찾을 수 없습니다(만료되었거나 서버가 재시작됨)")
    return job.to_dict()


@router.post("/seed-search/{job_id}/stop")
def seed_search_stop(job_id: str) -> dict:
    job = ssvc.stop_job(job_id)
    if job is None:
        raise HTTPException(404, "탐색 작업을 찾을 수 없습니다(만료되었거나 서버가 재시작됨)")
    return job.to_dict()


@router.delete("/history")
def reset_history(
    target_draw_no: int | None = Query(None, ge=1, description="미지정 시 현재 회차(최신 회차 + 1)"),
    session: Session = Depends(get_session),
) -> dict:
    """S4.12 추천 초기화 — 현재 회차의 사용자 생성(origin=user) 추천만 삭제."""
    try:
        return rsvc.reset_recommendations(session, target_draw_no)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


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
