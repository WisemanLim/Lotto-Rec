"""분석 API — runs 생성/상태/섹션 조회, itemset 질의 (PRD §11)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core import itemsets
from app.core.null_model import GAME
from app.db.base import get_session
from app.services import analysis_service as svc
from app.services.draws import load_draws

router = APIRouter(prefix="/analysis", tags=["analysis"])


class RunCreate(BaseModel):
    cohort: str = Field("A", pattern="^(A|B|ALL)$")
    preset: str = Field("quick", pattern="^(quick|report|deep)$")
    alpha: float | None = Field(None, gt=0, lt=1)
    correction: str | None = Field(None, pattern="^(bonferroni|holm|fdr_bh|fdr_by)$")
    seed: int | None = None
    mc_iterations: int | None = Field(None, ge=100, le=2_000_000)
    sync: bool = Field(False, description="true 면 동기 실행(테스트/소규모)")


@router.post("/runs")
def create_run(body: RunCreate, session: Session = Depends(get_session)) -> dict:
    try:
        run = svc.create_run(
            session,
            cohort=body.cohort,
            preset=body.preset,
            alpha=body.alpha,
            correction=body.correction,
            seed=body.seed,
            mc_iterations=body.mc_iterations,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if body.sync:
        svc.execute_run(run.run_id)
        session.expire_all()
        run = svc.get_run(session, run.run_id)  # type: ignore[assignment]
    else:
        svc.start_run_background(run.run_id)
    return svc.run_to_dict(run)


@router.get("/runs")
def list_runs(limit: int = Query(50, ge=1, le=500), session: Session = Depends(get_session)) -> list[dict]:
    return [svc.run_to_dict(r) for r in svc.list_runs(session, limit)]


@router.get("/runs/latest")
def latest_run(
    cohort: str | None = Query(None, pattern="^(A|B|ALL)$"), session: Session = Depends(get_session)
) -> dict:
    r = svc.latest_done_run(session, cohort)
    if r is None:
        raise HTTPException(404, "완료된 run 없음")
    return svc.run_to_dict(r)


@router.get("/runs/{run_id}")
def get_run(run_id: str, session: Session = Depends(get_session)) -> dict:
    r = svc.get_run(session, run_id)
    if r is None:
        raise HTTPException(404, "run 없음")
    return svc.run_to_dict(r)


@router.delete("/runs/{run_id}")
def delete_run(run_id: str, session: Session = Depends(get_session)) -> dict:
    r = svc.get_run(session, run_id)
    if r is None:
        raise HTTPException(404, "run 없음")
    if r.status == "running":
        raise HTTPException(409, "실행 중인 run 은 삭제 불가")
    from app.db.models import AnalysisResult

    session.execute(delete(AnalysisResult).where(AnalysisResult.run_id == run_id))
    session.delete(r)
    session.commit()
    return {"deleted": run_id}


@router.get("/runs/{run_id}/{section}")
def get_section(run_id: str, section: str, session: Session = Depends(get_session)) -> dict:
    if section not in svc.SECTIONS:
        raise HTTPException(404, f"섹션 없음: {section}. 가능: {svc.SECTIONS}")
    r = svc.get_run(session, run_id)
    if r is None:
        raise HTTPException(404, "run 없음")
    if r.status != "done":
        raise HTTPException(409, f"run 상태 {r.status} ({r.stage}, {r.progress:.0%})")
    payload = svc.get_section(session, run_id, section)
    if payload is None:
        raise HTTPException(404, "결과 없음")
    return payload


class ItemsetQuery(BaseModel):
    items: list[int] | None = Field(None, description="집합 S — 동시출현 검정")
    target: list[int] | None = Field(None, description="조건부: target | given")
    given: list[int] | None = None
    cohort: str = Field("A", pattern="^(A|B|ALL)$")
    draw_to: int | None = None


@router.post("/itemsets/query")
def itemset_query(body: ItemsetQuery, session: Session = Depends(get_session)) -> dict:
    from app.services.draws import cohort_range, max_draw_no

    mx = max_draw_no(session)
    lo, hi = cohort_range(body.cohort, mx)
    if body.draw_to:
        hi = min(hi or body.draw_to, body.draw_to)
    ds = load_draws(session, lo, hi)
    if ds.T == 0:
        raise HTTPException(400, "데이터 없음")
    x = ds.incidence
    out: dict = {"T": ds.T, "draw_from": int(ds.draw_no.min()), "draw_to": int(ds.draw_no.max())}
    try:
        if body.items:
            if not 1 <= len(body.items) <= GAME.k or len(set(body.items)) != len(body.items):
                raise HTTPException(400, "items: 1~6개 서로 다른 번호")
            out["itemset"] = itemsets.itemset_stats(x, body.items, GAME)
        if body.target and body.given:
            out["conditional"] = itemsets.conditional_stats(x, body.target, body.given, GAME)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if "itemset" not in out and "conditional" not in out:
        raise HTTPException(400, "items 또는 (target, given) 필요")
    return out
