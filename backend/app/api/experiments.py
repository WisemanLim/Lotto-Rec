"""실험 API — 전략 개선 루프 (PRD §E9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.recommend import strategies as strat
from app.db.base import get_session
from app.services import experiment_service as xsvc

router = APIRouter(prefix="/experiments", tags=["experiments"])


class ExperimentIn(BaseModel):
    strategy: str
    name: str | None = None
    base_params: dict | None = None
    parent_id: str | None = None
    search: str = Field("random", pattern="^(random|coordinate)$")
    n_candidates: int = Field(8, ge=1, le=50)
    tune_from: int | None = Field(None, ge=2)
    tune_to: int | None = None
    holdout_from: int | None = None
    holdout_to: int | None = None
    tickets_per_draw: int | None = Field(None, ge=1, le=50)
    seed: int | None = None
    sync: bool = False


@router.get("/strategy-params")
def strategy_params() -> dict:
    return {
        "strategies": [
            {"id": k, **v, "params": strat.STRATEGY_PARAMS.get(k, {}), "defaults": strat.default_params(k)}
            for k, v in strat.STRATEGIES.items()
        ]
    }


@router.post("/runs")
def create(body: ExperimentIn, session: Session = Depends(get_session)) -> dict:
    try:
        e = xsvc.create_experiment(session, body.model_dump(exclude={"sync"}, exclude_none=True))
    except ValueError as ex:
        raise HTTPException(400, str(ex)) from ex
    if body.sync:
        xsvc.execute_experiment(e.experiment_id)
        session.expire_all()
        e = session.get(type(e), e.experiment_id)  # type: ignore[assignment]
        if e.status == "error":
            raise HTTPException(500, e.error or "experiment error")
    else:
        xsvc.start_background(e.experiment_id)
    return xsvc.e_to_dict(e)


@router.get("/runs")
def list_runs(
    strategy: str | None = None, limit: int = Query(100, ge=1, le=500), session: Session = Depends(get_session)
) -> list[dict]:
    return [xsvc.e_to_dict(e) for e in xsvc.list_experiments(session, strategy, limit)]


@router.get("/active")
def active(strategy: str | None = None, session: Session = Depends(get_session)) -> dict:
    out = {}
    for s in [strategy] if strategy else list(strat.STRATEGIES):
        e = xsvc.active_experiment(session, s)
        out[s] = xsvc.e_to_dict(e) if e else None
    return out


@router.get("/lineage")
def lineage(strategy: str, session: Session = Depends(get_session)) -> dict:
    if strategy not in strat.STRATEGIES:
        raise HTTPException(404, "전략 없음")
    return xsvc.lineage(session, strategy)


@router.get("/runs/{experiment_id}")
def get_one(experiment_id: str, session: Session = Depends(get_session)) -> dict:
    e = session.get(xsvc.Experiment, experiment_id)
    if e is None:
        raise HTTPException(404, "없음")
    return xsvc.e_to_dict(e)


@router.post("/runs/{experiment_id}/activate")
def activate(experiment_id: str, session: Session = Depends(get_session)) -> dict:
    try:
        return xsvc.e_to_dict(xsvc.activate(session, experiment_id))
    except ValueError as ex:
        raise HTTPException(400, str(ex)) from ex


@router.post("/deactivate")
def deactivate(strategy: str, session: Session = Depends(get_session)) -> dict:
    xsvc.deactivate(session, strategy)
    return {"strategy": strategy, "active": None}


@router.delete("/runs/{experiment_id}")
def delete(experiment_id: str, session: Session = Depends(get_session)) -> dict:
    e = session.get(xsvc.Experiment, experiment_id)
    if e is None:
        raise HTTPException(404, "없음")
    if e.status == "running":
        raise HTTPException(409, "실행 중")
    session.delete(e)
    session.commit()
    return {"deleted": experiment_id}
