"""검증 API (PRD §E3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.base import get_session
from app.services import validation_service as vsvc

router = APIRouter(prefix="/validation", tags=["validation"])
KINDS = ["meta", "backtest", "scoring", "replication", "homogeneity"]


class ValidationIn(BaseModel):
    run_id_a: str | None = None
    strategies: list[str] | None = None
    tickets_per_draw: int | None = Field(None, ge=1, le=50)
    from_draw: int | None = Field(None, ge=2)
    to_draw: int | None = None
    seed: int | None = None
    insert_draws: bool = True
    sync: bool = False


@router.post("/runs")
def create(body: ValidationIn, session: Session = Depends(get_session)) -> dict:
    params = body.model_dump(exclude={"sync"}, exclude_none=True)
    params["insert_draws"] = body.insert_draws
    v = vsvc.create_validation(session, params)
    if body.sync:
        vsvc.execute_validation(v.validation_id)
        session.expire_all()
        v = vsvc.get_validation(session, v.validation_id)  # type: ignore[assignment]
        if v.status == "error":
            raise HTTPException(500, v.error or "validation error")
    else:
        vsvc.start_background(v.validation_id)
    return vsvc.v_to_dict(v)


@router.get("/runs")
def list_runs(limit: int = Query(20, ge=1, le=200), session: Session = Depends(get_session)) -> list[dict]:
    return [vsvc.v_to_dict(v) for v in vsvc.list_validations(session, limit)]


@router.get("/runs/latest")
def latest(session: Session = Depends(get_session)) -> dict:
    v = vsvc.latest_done(session)
    if v is None:
        raise HTTPException(404, "완료된 검증 없음")
    return vsvc.v_to_dict(v)


@router.get("/runs/{validation_id}")
def get(validation_id: str, session: Session = Depends(get_session)) -> dict:
    v = vsvc.get_validation(session, validation_id)
    if v is None:
        raise HTTPException(404, "없음")
    return vsvc.v_to_dict(v)


@router.get("/runs/{validation_id}/{kind}")
def get_kind(validation_id: str, kind: str, session: Session = Depends(get_session)) -> dict:
    if kind not in KINDS:
        raise HTTPException(404, f"kind 는 {KINDS}")
    v = vsvc.get_validation(session, validation_id)
    if v is None:
        raise HTTPException(404, "없음")
    if v.status != "done":
        raise HTTPException(409, f"상태 {v.status} ({v.stage}, {v.progress:.0%})")
    p = vsvc.get_kind(session, validation_id, kind)
    if p is None:
        raise HTTPException(404, "결과 없음")
    return p
