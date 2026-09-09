"""성과 추적 (PRD §E8) — 티켓 vs 실제 추첨 대조, 전략별 누적 성과 vs 하이퍼지오메트릭 영분포."""

from __future__ import annotations

import numpy as np
from scipy import stats
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.null_model import GAME
from app.core.recommend.scorecard import hypergeom_match_var
from app.core.timeutil import to_iso
from app.db.models import Draw, Recommendation, TicketOutcome, UserTicket
from app.services.past_wins import PastWinIndex

TICKET_PRICE = 1000


def rank_of(main_matches: int, bonus_match: bool) -> int:
    if main_matches == 6:
        return 1
    if main_matches == 5:
        return 2 if bonus_match else 3
    if main_matches == 4:
        return 4
    if main_matches == 3:
        return 5
    return 0


def prize_for(rank: int, draw: Draw) -> int:
    if rank == 1:
        return int(draw.prize1 or 0)
    if rank == 2:
        return int(draw.prize2 or 0)
    if rank == 3:
        return settings.lotto_prize_rank3_default
    if rank == 4:
        return settings.lotto_prize_rank4_default
    if rank == 5:
        return settings.lotto_prize_rank5_default
    return 0


def evaluate_ticket(ticket: list[int], draw: Draw) -> tuple[int, bool, int, int]:
    main = set(draw.numbers)
    m = len(main & set(ticket))
    b = draw.bonus in ticket
    r = rank_of(m, b)
    return m, b, r, prize_for(r, draw)


def evaluate_draw(session: Session, draw_no: int) -> int:
    """해당 회차를 대상으로 하는 미평가 티켓(추천·사용자) 전부 대조. 반환: 생성된 outcome 수."""
    draw = session.get(Draw, draw_no)
    if draw is None:
        return 0
    done_rec = set(
        session.scalars(
            select(TicketOutcome.ticket_ref).where(
                TicketOutcome.draw_no == draw_no, TicketOutcome.source == "recommendation"
            )
        ).all()
    )
    done_usr = set(
        session.scalars(
            select(TicketOutcome.ticket_ref).where(TicketOutcome.draw_no == draw_no, TicketOutcome.source == "user")
        ).all()
    )
    n = 0
    for rec in session.scalars(select(Recommendation).where(Recommendation.target_draw_no == draw_no)).all():
        if rec.rec_id in done_rec:
            continue
        m, b, r, prize = evaluate_ticket(list(rec.ticket), draw)
        session.add(
            TicketOutcome(
                source="recommendation",
                ticket_ref=rec.rec_id,
                strategy=rec.strategy,
                origin=rec.origin,
                draw_no=draw_no,
                ticket=rec.ticket,
                main_matches=m,
                bonus_match=b,
                rank=r,
                prize_amount=prize,
            )
        )
        n += 1
    for ut in session.scalars(select(UserTicket).where(UserTicket.target_draw_no == draw_no)).all():
        if ut.ticket_id in done_usr:
            continue
        m, b, r, prize = evaluate_ticket(list(ut.numbers), draw)
        session.add(
            TicketOutcome(
                source="user",
                ticket_ref=ut.ticket_id,
                strategy="user",
                origin="user",
                draw_no=draw_no,
                ticket=ut.numbers,
                main_matches=m,
                bonus_match=b,
                rank=r,
                prize_amount=prize,
            )
        )
        n += 1
    session.flush()
    return n


def tracking_hook(session: Session, inserted: list[int], trigger: str) -> str | None:
    if trigger == "seed":
        return None
    for d in inserted:
        evaluate_draw(session, d)
    return None


def _strategy_summary(rows: list[TicketOutcome]) -> dict:
    game = GAME
    n = len(rows)
    m = np.array([r.main_matches for r in rows], dtype=float)
    md = game.match_distribution()
    hist = [int((m == i).sum()) for i in range(game.k + 1)]
    exp_hist = (md * n).tolist()
    mean = float(m.mean()) if n else None
    var = hypergeom_match_var(game)
    z = float((float(m.mean()) - game.expected_overlap) / np.sqrt(var / n)) if n else None
    p = float(2 * stats.norm.sf(abs(z))) if z is not None else None
    ranks = [r.rank for r in rows]
    rp = game.rank_probabilities()
    rank_counts = {f"rank{k}": int(sum(1 for r in ranks if r == k)) for k in range(1, 6)}
    rank_expected = {f"rank{k}": float(rp[f"rank{k}"] * n) for k in range(1, 6)}
    ge3 = int((m >= 3).sum())
    p_ge3 = float(md[3:].sum())
    ge3_p = float(stats.binomtest(ge3, n, p_ge3).pvalue) if n else None
    prize = int(sum(r.prize_amount for r in rows))
    cost = n * TICKET_PRICE
    # 누적 곡선 (회차 순)
    by_draw: dict[int, list[TicketOutcome]] = {}
    for r in rows:
        by_draw.setdefault(r.draw_no, []).append(r)
    cum_exp = cum_obs = 0.0
    curve = []
    for d in sorted(by_draw):
        cum_obs += sum(x.main_matches for x in by_draw[d])
        cum_exp += len(by_draw[d]) * game.expected_overlap
        curve.append(
            {
                "draw_no": d,
                "cum_matches": cum_obs,
                "cum_expected": cum_exp,
                "n_tickets": len(by_draw[d]),
                "prize": int(sum(x.prize_amount for x in by_draw[d])),
            }
        )
    # 최대 일치수의 영분포 p: P(max of n ≥ observed max)
    max_m = int(m.max()) if n else None
    p_max = float(1 - (1 - md[max_m:].sum()) ** n) if n and max_m is not None else None
    return {
        "n_tickets": n,
        "n_draws": len(by_draw),
        "match_hist": hist,
        "match_hist_expected": exp_hist,
        "mean_matches": mean,
        "expected_matches": game.expected_overlap,
        "z": z,
        "p": p,
        "rank_counts": rank_counts,
        "rank_expected": rank_expected,
        "n_ge3": ge3,
        "expected_ge3": p_ge3 * n,
        "p_ge3_binomial": ge3_p,
        "total_prize": prize,
        "total_cost": cost,
        "roi": (prize - cost) / cost if cost else None,
        "max_matches": max_m,
        "p_max_matches_null": p_max,
        "curve": curve,
    }


def tracking_summary(session: Session, origin: str | None = None) -> dict:
    stmt = select(TicketOutcome)
    if origin:
        stmt = stmt.where(TicketOutcome.origin == origin)
    rows = list(session.scalars(stmt).all())
    by_strat: dict[str, list[TicketOutcome]] = {}
    for r in rows:
        by_strat.setdefault(r.strategy, []).append(r)
    strategies = {s: _strategy_summary(v) for s, v in by_strat.items()}
    # 균등 대비 차이 (회차 페어링 부트스트랩 CI)
    ctrl = by_strat.get("uniform")
    comparison = {}
    if ctrl:
        c_by: dict[int, list[int]] = {}
        for r in ctrl:
            c_by.setdefault(r.draw_no, []).append(r.main_matches)
        for s, v in by_strat.items():
            if s == "uniform":
                continue
            s_by: dict[int, list[int]] = {}
            for r in v:
                s_by.setdefault(r.draw_no, []).append(r.main_matches)
            common = sorted(set(c_by) & set(s_by))
            if len(common) < 5:
                continue
            diff = np.array([np.mean(s_by[d]) - np.mean(c_by[d]) for d in common])
            rng = np.random.default_rng(0)
            boots = np.array([rng.choice(diff, len(diff)).mean() for _ in range(2000)])
            comparison[s] = {
                "n_draws": len(common),
                "mean_diff": float(diff.mean()),
                "ci95": [float(np.quantile(boots, 0.025)), float(np.quantile(boots, 0.975))],
                "verdict": "균등 대비 유의한 개선"
                if np.quantile(boots, 0.025) > 0
                else ("균등 대비 유의한 저하" if np.quantile(boots, 0.975) < 0 else "균등과 차이 없음"),
            }
    pending = pending_tickets(session)
    return {
        "strategies": strategies,
        "comparison_vs_uniform": comparison,
        "n_outcomes": len(rows),
        "pending": pending,
        "policy": "모든 전략의 이론 당첨확률은 동일. 차이는 표본 변동으로 해석하고 CI 를 함께 본다.",
    }


def pending_tickets(session: Session) -> dict:
    mx = session.scalar(select(func.max(Draw.draw_no))) or 0
    recs = session.scalars(select(Recommendation).where(Recommendation.target_draw_no > mx)).all()
    users = session.scalars(select(UserTicket).where(UserTicket.target_draw_no > mx)).all()
    return {
        "max_draw_in_db": int(mx),
        "recommendations": len(recs),
        "user_tickets": len(users),
        "target_draws": sorted({r.target_draw_no for r in recs} | {u.target_draw_no for u in users}),
    }


def _outcome_stmt(strategy: str | None, draw_no: int | None, source: str | None, origin: str | None):  # noqa: ANN202
    stmt = select(TicketOutcome)
    if strategy:
        stmt = stmt.where(TicketOutcome.strategy == strategy)
    if draw_no:
        stmt = stmt.where(TicketOutcome.draw_no == draw_no)
    if source:
        stmt = stmt.where(TicketOutcome.source == source)
    if origin and origin != "all":
        stmt = stmt.where(TicketOutcome.origin == origin)
    return stmt


def outcomes(
    session: Session,
    *,
    strategy: str | None = None,
    draw_no: int | None = None,
    source: str | None = None,
    origin: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[dict]:
    stmt = _outcome_stmt(strategy, draw_no, source, origin)
    rows = session.scalars(
        stmt.order_by(TicketOutcome.draw_no.desc(), TicketOutcome.outcome_id.desc()).offset(offset).limit(limit)
    ).all()
    past = PastWinIndex(session)
    return [
        {
            "outcome_id": r.outcome_id,
            "source": r.source,
            "ticket_ref": r.ticket_ref,
            "strategy": r.strategy,
            "origin": r.origin,
            "draw_no": r.draw_no,
            "ticket": r.ticket,
            "past_wins": past.lookup(r.ticket),
            "main_matches": r.main_matches,
            "bonus_match": r.bonus_match,
            "rank": r.rank,
            "prize_amount": r.prize_amount,
            "evaluated_at": to_iso(r.evaluated_at),
        }
        for r in rows
    ]


def outcomes_summary(
    session: Session,
    *,
    strategy: str | None = None,
    draw_no: int | None = None,
    source: str | None = None,
    origin: str | None = None,
) -> dict:
    """필터 건수 + 필터 옵션(회차·전략·출처별 건수) — origin 범위 안에서 집계 (PRD S8.6)."""
    base = _outcome_stmt(strategy, draw_no, source, origin)
    total = int(session.scalar(select(func.count()).select_from(base.subquery())) or 0)
    scope = _outcome_stmt(None, None, None, origin).subquery()
    total_all = int(session.scalar(select(func.count()).select_from(scope)) or 0)
    draw_nos = [
        int(d) for d in session.scalars(select(scope.c.draw_no).distinct().order_by(scope.c.draw_no.desc())).all()
    ]
    strategies = {
        k: int(v) for k, v in session.execute(select(scope.c.strategy, func.count()).group_by(scope.c.strategy)).all()
    }
    by_source = {
        k: int(v) for k, v in session.execute(select(scope.c.source, func.count()).group_by(scope.c.source)).all()
    }
    by_origin = {
        k: int(v)
        for k, v in session.execute(select(TicketOutcome.origin, func.count()).group_by(TicketOutcome.origin)).all()
    }
    return {
        "total_filtered": total,
        "total_all": total_all,
        "origin": origin or "all",
        "draw_nos": draw_nos,
        "strategies": strategies,
        "by_source": by_source,
        "by_origin": by_origin,
    }
