"""추천 생성·저장 + 사용자 티켓 스코어카드 (PRD §E4, §E5)."""

from __future__ import annotations

import uuid

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.null_model import GAME
from app.core.recommend import strategies as strat
from app.core.recommend.scorecard import scorecard
from app.core.timeutil import to_iso
from app.db.models import Recommendation, UserTicket
from app.services import analysis_service as asvc
from app.services import experiment_service as xsvc
from app.services.draws import DrawSet, load_draws, max_draw_no


def build_context(session: Session, *, draw_to: int | None = None, use_winners_model: bool = True) -> strat.Context:
    mx = max_draw_no(session) or 0
    hi = mx if draw_to is None else min(draw_to, mx)
    ds: DrawSet = load_draws(session, 1, hi)
    wm = None
    if use_winners_model:
        run = asvc.latest_done_run(session, "A") or asvc.latest_done_run(session)
        if run is not None:
            wm = asvc.get_section(session, run.run_id, "winners_model")
    return strat.Context(
        incidence=ds.incidence,
        draw_no_next=hi + 1,
        game=GAME,
        winners_model=wm,
        null_features=asvc.get_null_features(),
        extra={"run_id": run.run_id if wm and run else None, "draws": ds.main},
    )


def recommend(
    session: Session,
    *,
    strategy: str,
    count: int | None = None,
    seed: int | None = None,
    max_shared: int | None = None,
    include_control: bool = True,
    save: bool = True,
) -> dict:
    count = count or settings.lotto_number_recommendation_count
    if not 1 <= count <= 50:
        raise ValueError("추천 개수는 1~50")
    seed = settings.lotto_random_seed if seed is None else seed
    ctx = build_context(session)
    batch_id = str(uuid.uuid4())
    out_sets = []
    strategies = [strategy] + (["uniform"] if include_control and strategy != "uniform" else [])
    for i, s in enumerate(strategies):
        params_used, active_exp = xsvc.active_params(session, s)
        tickets, meta = strat.generate(s, ctx, count, seed + i, max_shared, params_used)
        cards = [
            scorecard(
                t,
                ctx.incidence,
                ctx.extra["draws"],
                null_features=ctx.null_features,
                winners_model=ctx.winners_model,
                draw_no_next=ctx.draw_no_next,
            )
            for t in tickets
        ]
        rows = []
        for t, c in zip(tickets, cards, strict=True):
            rec_id = None
            if save:
                rec = Recommendation(
                    batch_id=batch_id,
                    run_id=ctx.extra.get("run_id"),
                    strategy=s,
                    params={
                        "count": count,
                        "max_shared": max_shared,
                        **{k: v for k, v in meta.items() if k != "strategy"},
                    },
                    seed=meta["seed"],
                    ticket=t,
                    scorecard=_compact(c),
                    target_draw_no=ctx.draw_no_next,
                    origin="user",
                )
                session.add(rec)
                session.flush()
                rec_id = rec.rec_id
            rows.append({"rec_id": rec_id, "ticket": t, "scorecard": c})
        out_sets.append(
            {
                "strategy": s,
                "label": strat.STRATEGIES[s]["label"],
                "basis": strat.STRATEGIES[s]["basis"],
                "expectation": strat.STRATEGIES[s]["expectation"],
                "meta": meta,
                "params_used": params_used,
                "experiment": None
                if active_exp is None
                else {
                    "experiment_id": active_exp.experiment_id,
                    "iteration": active_exp.iteration,
                    "holdout": (active_exp.metrics_holdout or {}).get("diff_vs_uniform"),
                    "holdout_mean": (active_exp.metrics_holdout or {}).get("mean_matches"),
                    "verdict": (active_exp.metrics_holdout or {}).get("verdict"),
                },
                "tickets": rows,
                "is_control": s == "uniform" and strategy != "uniform",
            }
        )
    if save:
        session.commit()
    return {
        "batch_id": batch_id,
        "target_draw_no": ctx.draw_no_next,
        "history_T": ctx.T,
        "count": count,
        "seed": seed,
        "run_id": ctx.extra.get("run_id"),
        "sets": out_sets,
        "analysis_basis": _analysis_basis(ctx),
        "policy": "추천번호는 균등 무작위와 동일한 당첨확률. 전략 성과는 성과 추적·검증 리포트로 확인.",
    }


def _analysis_basis(ctx: strat.Context) -> dict:
    """추천이 근거한 분석 요약 (PRD S4.8): 군 A run, 이력 T, 상위 |z| 번호, 상위 Lift* 쌍."""
    z = ctx.z_scores()
    order = np.argsort(-np.abs(z))[:8]
    lift = ctx.lift_matrix()
    iu = np.triu_indices(ctx.game.N, 1)
    lv = lift[iu]
    top = np.argsort(-lv)[:8]
    return {
        "run_id_a": ctx.extra.get("run_id"),
        "history_T": ctx.T,
        "train_end_draw": settings.lotto_train_end_draw,
        "cohort_note": "이력 = 1회~직전 회차 전체(군 A + 누적 군 B). 군 A 경계 이후 데이터가 있으면 포함됨.",
        "top_abs_z_numbers": [{"number": int(i + 1), "z": float(z[i])} for i in order],
        "top_lift_pairs": [{"a": int(iu[0][j] + 1), "b": int(iu[1][j] + 1), "lift": float(lv[j])} for j in top],
        "winners_model_used": bool(ctx.winners_model and "coef" in ctx.winners_model),
    }


def _compact(c: dict) -> dict:
    return {
        "mean_pair_lift": c.get("mean_pair_lift"),
        "typicality_p": c.get("typicality", {}).get("typicality_p"),
        "features": c.get("typicality", {}).get("features"),
        "winners": c.get("winners"),
        "per_number_z": [round(p["z"], 3) for p in c.get("per_number", [])],
    }


def evaluate_user_ticket(session: Session, numbers: list[int], bonus: int | None = None) -> dict:
    ctx = build_context(session)
    return scorecard(
        numbers,
        ctx.incidence,
        ctx.extra["draws"],
        null_features=ctx.null_features,
        winners_model=ctx.winners_model,
        draw_no_next=ctx.draw_no_next,
        bonus=bonus,
    )


def save_user_ticket(
    session: Session, numbers: list[int], bonus: int | None, label: str | None, target_draw_no: int | None
) -> UserTicket:
    mx = max_draw_no(session) or 0
    card = evaluate_user_ticket(session, numbers, bonus)
    ut = UserTicket(
        numbers=sorted(numbers),
        bonus=bonus,
        label=label,
        target_draw_no=target_draw_no or mx + 1,
        scorecard=_compact(card),
    )
    session.add(ut)
    session.commit()
    return ut


def _history_stmt(origin: str, strategy: str | None, batch_id: str | None, target_draw_no: int | None):  # noqa: ANN202
    stmt = select(Recommendation)
    if origin != "all":
        stmt = stmt.where(Recommendation.origin == origin)
    if strategy:
        stmt = stmt.where(Recommendation.strategy == strategy)
    if batch_id:
        stmt = stmt.where(Recommendation.batch_id == batch_id)
    if target_draw_no:
        stmt = stmt.where(Recommendation.target_draw_no == target_draw_no)
    return stmt


def list_recommendations(
    session: Session,
    *,
    limit: int = 200,
    offset: int = 0,
    origin: str = "user",
    strategy: str | None = None,
    batch_id: str | None = None,
    target_draw_no: int | None = None,
) -> list[dict]:
    """추천 이력 — 필터(전략·batch·대상 회차) + offset 페이징 (PRD S4.6)."""
    stmt = _history_stmt(origin, strategy, batch_id, target_draw_no)
    rows = session.scalars(stmt.order_by(Recommendation.rec_id.desc()).offset(offset).limit(limit)).all()
    return [
        {
            "rec_id": r.rec_id,
            "batch_id": r.batch_id,
            "strategy": r.strategy,
            "ticket": r.ticket,
            "seed": r.seed,
            "target_draw_no": r.target_draw_no,
            "origin": r.origin,
            "scorecard": r.scorecard,
            "params": r.params,
            "created_at": to_iso(r.created_at),
        }
        for r in rows
    ]


def history_summary(
    session: Session,
    *,
    origin: str = "user",
    strategy: str | None = None,
    batch_id: str | None = None,
    target_draw_no: int | None = None,
) -> dict:
    """필터 적용 건수 + 전략별 건수 + 대상 회차·batch 목록 (필터 UI 옵션용)."""
    from sqlalchemy import func, true

    base = _history_stmt(origin, strategy, batch_id, target_draw_no)
    total = int(session.scalar(select(func.count()).select_from(base.subquery())) or 0)
    all_stmt = _history_stmt(origin, None, None, None)
    ocond = Recommendation.origin == origin if origin != "all" else true()
    by_strategy = session.execute(
        select(Recommendation.strategy, func.count()).where(ocond).group_by(Recommendation.strategy)
    ).all()
    by_origin = session.execute(select(Recommendation.origin, func.count()).group_by(Recommendation.origin)).all()
    targets = session.scalars(
        select(Recommendation.target_draw_no).where(ocond).distinct().order_by(Recommendation.target_draw_no.desc())
    ).all()
    batches = session.execute(
        select(
            Recommendation.batch_id,
            func.min(Recommendation.created_at),
            func.count(),
            func.min(Recommendation.target_draw_no),
        )
        .where(ocond)
        .group_by(Recommendation.batch_id)
        .order_by(func.min(Recommendation.rec_id).desc())
        .limit(200)
    ).all()
    grand = int(session.scalar(select(func.count()).select_from(all_stmt.subquery())) or 0)
    return {
        "total_filtered": total,
        "total_all": grand,
        "origin": origin,
        "by_origin": {k: int(v) for k, v in by_origin},
        "by_strategy": {k: int(v) for k, v in by_strategy},
        "target_draws": [int(t) for t in targets],
        "batches": [
            {"batch_id": b, "created_at": to_iso(c), "count": int(n), "target_draw_no": int(t)}
            for b, c, n, t in batches
        ],
    }


def strategy_catalog() -> list[dict]:
    return [{"id": k, **v} for k, v in strat.STRATEGIES.items()]


__all__ = [
    "recommend",
    "evaluate_user_ticket",
    "save_user_ticket",
    "list_recommendations",
    "strategy_catalog",
    "build_context",
    "np",
]
