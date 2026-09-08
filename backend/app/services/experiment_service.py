"""전략 개선 루프 — 시뮬레이션 실험 (PRD §E9, §4.12).

A 분석 → 전략 파라미터 후보 K → 튠 구간 B₁ replay → 최고 후보 → 홀드아웃 B₂ replay
→ best-of-K 영분포·optimism·계보 검정.
"""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime

import numpy as np
from scipy import stats
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.data_io import DrawRecord, load_source_file
from app.core.features import incidence_from_draws
from app.core.null_model import GAME
from app.core.recommend import strategies as strat
from app.core.recommend.scorecard import hypergeom_match_var
from app.core.timeutil import to_iso
from app.db.base import SessionLocal
from app.db.models import Draw, Experiment
from app.services import analysis_service as asvc
from app.services.draws import load_draws
from app.services.tracking_service import evaluate_ticket

# ---------------------------------------------------------------- replay (순수 함수)


def replay(
    specs: list[dict],
    records: list[DrawRecord],
    x_hist: np.ndarray,
    n_tickets: int,
    seed: int,
    winners_model: dict | None,
    null_features: np.ndarray | None,
    progress=None,  # noqa: ANN001
) -> dict[str, dict]:
    """specs: [{label, strategy, params}] → label → {outcomes: [...], scoring: [(brier, log)]}.

    각 회차 t 의 티켓은 t−1 까지 이력만 사용(look-ahead 금지). 이력은 회차마다 확장.
    """
    out: dict[str, dict] = {s["label"]: {"outcomes": [], "scoring": []} for s in specs}
    x = x_hist.copy()
    for idx, rec in enumerate(records):
        t = rec.draw_no
        ctx = strat.Context(
            incidence=x, draw_no_next=t, game=GAME, winners_model=winners_model, null_features=null_features
        )
        y = np.zeros(GAME.N)
        y[[n - 1 for n in rec.numbers]] = 1
        draw_obj = Draw(**rec.as_dict())
        for si, sp in enumerate(specs):
            tickets, _ = strat.generate(sp["strategy"], ctx, n_tickets, seed + 1000 * si + t, None, sp.get("params"))
            pvec = strat.probability_vector(ctx, sp["strategy"], sp.get("params"))
            brier = float(np.mean((pvec - y) ** 2))
            logs = float(np.sum(y * np.log(pvec) + (1 - y) * np.log(1 - pvec)))
            out[sp["label"]]["scoring"].append((brier, logs))
            for tk in tickets:
                m, b, r, prize = evaluate_ticket(tk, draw_obj)
                out[sp["label"]]["outcomes"].append(
                    {"draw_no": t, "ticket": tk, "matches": m, "bonus": b, "rank": r, "prize": prize}
                )
        x = np.vstack([x, incidence_from_draws(np.array([rec.numbers]), GAME.N)])
        if progress and idx % 10 == 0:
            progress((idx + 1) / len(records))
    return out


def metrics(rows: list[dict], control_rows: list[dict] | None = None, scoring: list | None = None) -> dict:
    """평균 일치·z·≥3·등수·균등 대비 페어링 diff(부트스트랩 CI)·Brier/log."""
    game = GAME
    n = len(rows)
    m = np.array([r["matches"] for r in rows], dtype=float)
    md = game.match_distribution()
    var = hypergeom_match_var(game)
    mean = float(m.mean()) if n else None
    z = float((float(m.mean()) - game.expected_overlap) / np.sqrt(var / n)) if n else None
    out: dict = {
        "n_tickets": n,
        "n_draws": len({r["draw_no"] for r in rows}),
        "mean_matches": mean,
        "expected_matches": game.expected_overlap,
        "z": z,
        "p": float(2 * stats.norm.sf(abs(z))) if z is not None else None,
        "match_hist": [int((m == i).sum()) for i in range(game.k + 1)],
        "n_ge3": int((m >= 3).sum()),
        "expected_ge3": float(md[3:].sum() * n),
        "rank_counts": {f"rank{k}": int(sum(1 for r in rows if r["rank"] == k)) for k in range(1, 6)},
        "total_prize": int(sum(r["prize"] for r in rows)),
        "total_cost": n * 1000,
    }
    if scoring:
        a = np.array(scoring)
        out["brier_mean"] = float(a[:, 0].mean())
        out["log_score_mean"] = float(a[:, 1].mean())
    if control_rows:
        c_by: dict[int, list[int]] = {}
        s_by: dict[int, list[int]] = {}
        for r in control_rows:
            c_by.setdefault(r["draw_no"], []).append(r["matches"])
        for r in rows:
            s_by.setdefault(r["draw_no"], []).append(r["matches"])
        common = sorted(set(c_by) & set(s_by))
        if len(common) >= 3:
            diff = np.array([np.mean(s_by[d]) - np.mean(c_by[d]) for d in common])
            rng = np.random.default_rng(0)
            boots = np.array([rng.choice(diff, len(diff)).mean() for _ in range(2000)])
            lo, hi = float(np.quantile(boots, 0.025)), float(np.quantile(boots, 0.975))
            out["diff_vs_uniform"] = {
                "mean": float(diff.mean()),
                "ci95": [lo, hi],
                "n_draws": len(common),
                "p_paired_t": float(stats.ttest_1samp(diff, 0).pvalue) if len(diff) > 2 else None,
                "verdict": "균등 대비 유의한 개선"
                if lo > 0
                else ("균등 대비 유의한 저하" if hi < 0 else "균등과 차이 없음"),
            }
    return out


# ---------------------------------------------------------------- 후보 생성


def propose_candidates(strategy: str, base: dict, search: str, n: int, rng: np.random.Generator) -> list[dict]:
    """후보 파라미터 K 개 (첫 번째 = 기준). random: 범위 내 균일, coordinate: 한 파라미터씩 ±단계."""
    schema = strat.STRATEGY_PARAMS.get(strategy, {})
    base = strat.merge_params(strategy, base)
    cands = [dict(base)]
    if not schema:
        return cands
    keys = list(schema)
    attempts = 0
    while len(cands) < n and attempts < 50 * n:
        attempts += 1
        c = dict(base)
        if search == "coordinate":
            k = keys[(len(cands) - 1) % len(keys)]
            spec = schema[k]
            span = spec["max"] - spec["min"]
            step = span * rng.choice([-0.25, -0.1, 0.1, 0.25])
            c[k] = float(base[k]) + step
        else:
            for k, spec in schema.items():
                c[k] = float(rng.uniform(spec["min"], spec["max"]))
        c = strat.merge_params(strategy, c)
        if c not in cands:
            cands.append(c)
    return cands


def best_of_k_null(n_tickets_tune: int, k: int, n_sims: int = 20000, seed: int = 0) -> dict:
    """공정 추첨에서 K 후보 중 최고의 (전략−균등) 평균 일치 차이 분포 (정규근사, 독립 티켓)."""
    var = hypergeom_match_var(GAME)
    sd_diff = float(np.sqrt(2 * var / max(n_tickets_tune, 1)))
    rng = np.random.default_rng(seed)
    sims = rng.normal(0.0, sd_diff, size=(n_sims, k)).max(axis=1)
    return {
        "sd_single_diff": sd_diff,
        "expected_best_diff": float(sims.mean()),
        "q50": float(np.quantile(sims, 0.5)),
        "q90": float(np.quantile(sims, 0.9)),
        "q95": float(np.quantile(sims, 0.95)),
        "q99": float(np.quantile(sims, 0.99)),
        "k": k,
        "n_sims": n_sims,
        "_sims": sims,
    }


# ---------------------------------------------------------------- 실험 실행


def _b_records(lo: int, hi: int) -> list[DrawRecord]:
    rep = load_source_file(settings.source_file_path, pool_size=GAME.N, main_count=GAME.k)
    return [r for r in rep.records if lo <= r.draw_no <= hi]


def create_experiment(session: Session, params: dict) -> Experiment:
    strategy = params["strategy"]
    if strategy not in strat.STRATEGIES:
        raise ValueError(f"알 수 없는 전략: {strategy}")
    parent = session.get(Experiment, params["parent_id"]) if params.get("parent_id") else None
    if parent is None and not params.get("parent_id"):
        parent = latest_experiment(session, strategy)
    te = settings.lotto_train_end_draw
    exp = Experiment(
        experiment_id=str(uuid.uuid4()),
        name=params.get("name") or f"{strategy} iter",
        strategy=strategy,
        params=strat.merge_params(strategy, params.get("base_params") or (parent.params if parent else None)),
        parent_id=parent.experiment_id if parent else None,
        iteration=(parent.iteration + 1) if parent else 1,
        tune_from=int(params.get("tune_from") or te + 1),
        tune_to=int(params.get("tune_to") or te + 120),
        holdout_from=int(params.get("holdout_from") or te + 121),
        holdout_to=int(params.get("holdout_to") or te + 240),
        n_tickets=int(params.get("tickets_per_draw") or settings.lotto_number_recommendation_count),
        seed=int(params.get("seed") or settings.lotto_random_seed) + (parent.iteration if parent else 0),
        search=params.get("search") or "random",
        n_candidates=int(params.get("n_candidates") or 8),
        status="pending",
    )
    if exp.tune_to >= exp.holdout_from:
        raise ValueError("튠 구간과 홀드아웃 구간이 겹칩니다")
    session.add(exp)
    session.commit()
    return exp


def start_background(experiment_id: str) -> None:
    threading.Thread(target=execute_experiment, args=(experiment_id,), daemon=True).start()


def _upd(session: Session, e: Experiment, p: float, stage: str) -> None:
    e.progress, e.stage = float(p), stage
    session.commit()


def execute_experiment(experiment_id: str) -> None:
    with SessionLocal() as session:
        e = session.get(Experiment, experiment_id)
        if e is None:
            return
        try:
            e.status = "running"
            _upd(session, e, 0.0, "prepare")
            result = run_experiment(session, e, lambda p, s: _upd(session, e, p, s))
            e.candidates = result["candidates"]
            e.params = result["best_params"]
            e.metrics_tune = result["metrics_tune"]
            e.metrics_holdout = result["metrics_holdout"]
            e.h0_benchmark = result["h0_benchmark"]
            e.status, e.finished_at = "done", datetime.now(UTC)
            _upd(session, e, 1.0, "done")
        except Exception as ex:  # noqa: BLE001
            session.rollback()
            e = session.get(Experiment, experiment_id)
            if e is not None:
                e.status, e.error, e.finished_at = "error", f"{type(ex).__name__}: {ex}", datetime.now(UTC)
                session.commit()


def run_experiment(session: Session, e: Experiment, report) -> dict:  # noqa: ANN001
    tune = _b_records(e.tune_from, e.tune_to)
    hold = _b_records(e.holdout_from, e.holdout_to)
    if not tune or not hold:
        raise ValueError("튠/홀드아웃 구간 데이터 없음 (원천 xlsx 확인)")
    hist = load_draws(session, 1, e.tune_from - 1)
    x_hist = incidence_from_draws(hist.main, GAME.N) if hist.T else np.zeros((0, GAME.N), dtype=np.int8)
    run_a = asvc.latest_done_run(session, "A")
    wm = asvc.get_section(session, run_a.run_id, "winners_model") if run_a else None
    nf = asvc.get_null_features(e.seed)
    rng = np.random.default_rng(e.seed)

    cands = propose_candidates(e.strategy, e.params, e.search, e.n_candidates, rng)
    specs = [{"label": f"c{i}", "strategy": e.strategy, "params": c} for i, c in enumerate(cands)]
    specs.append({"label": "uniform", "strategy": "uniform", "params": {}})
    report(0.05, f"tune replay {e.tune_from}-{e.tune_to} × {len(cands)} 후보")
    res_t = replay(specs, tune, x_hist, e.n_tickets, e.seed, wm, nf, lambda f: report(0.05 + 0.6 * f, "tune replay"))
    ctrl_t = res_t["uniform"]["outcomes"]
    cand_metrics = []
    for i, c in enumerate(cands):
        mt = metrics(res_t[f"c{i}"]["outcomes"], ctrl_t, res_t[f"c{i}"]["scoring"])
        cand_metrics.append(
            {
                "index": i,
                "params": c,
                "mean_matches": mt["mean_matches"],
                "diff_vs_uniform": mt.get("diff_vs_uniform", {}).get("mean"),
                "n_ge3": mt["n_ge3"],
                "brier_mean": mt.get("brier_mean"),
            }
        )
    # 선택: 균등 대비 diff 최대 (동률 → ≥3 많은 순)
    best_i = max(
        range(len(cands)), key=lambda i: ((cand_metrics[i]["diff_vs_uniform"] or -9), cand_metrics[i]["n_ge3"])
    )
    best = cands[best_i]
    metrics_tune = metrics(res_t[f"c{best_i}"]["outcomes"], ctrl_t, res_t[f"c{best_i}"]["scoring"])
    metrics_tune["uniform"] = metrics(ctrl_t)
    metrics_tune["best_index"] = best_i

    # H0 best-of-K
    n_tune_tickets = len(res_t[f"c{best_i}"]["outcomes"])
    h0 = best_of_k_null(n_tune_tickets, len(cands), seed=e.seed)
    obs = metrics_tune.get("diff_vs_uniform", {}).get("mean")
    sims = h0.pop("_sims")
    h0["observed_best_diff"] = obs
    h0["percentile_of_observed"] = float((sims < obs).mean()) if obs is not None else None
    h0["p_best_of_k"] = float((sims >= obs).mean()) if obs is not None else None
    h0["note"] = (
        "정규근사(독립 티켓). 관측 최고 diff 가 K 후보 우연 최대값 분포의 상위 5% 밖이 아니면 선택 편향으로 설명됨."
    )

    # 홀드아웃: 최고 후보 + 균등만
    report(0.7, f"holdout replay {e.holdout_from}-{e.holdout_to}")
    x_hist2 = np.vstack([x_hist, incidence_from_draws(np.array([r.numbers for r in tune]), GAME.N)])
    specs_h = [
        {"label": "best", "strategy": e.strategy, "params": best},
        {"label": "uniform", "strategy": "uniform", "params": {}},
    ]
    res_h = replay(
        specs_h, hold, x_hist2, e.n_tickets, e.seed + 7, wm, nf, lambda f: report(0.7 + 0.25 * f, "holdout replay")
    )
    metrics_hold = metrics(res_h["best"]["outcomes"], res_h["uniform"]["outcomes"], res_h["best"]["scoring"])
    metrics_hold["uniform"] = metrics(res_h["uniform"]["outcomes"])
    hd = metrics_hold.get("diff_vs_uniform", {}).get("mean")
    metrics_hold["optimism"] = (obs - hd) if obs is not None and hd is not None else None
    metrics_hold["verdict"] = (
        "홀드아웃에서 균등 대비 유의한 개선 유지"
        if metrics_hold.get("diff_vs_uniform", {}).get("ci95", [0, 0])[0] > 0
        else "홀드아웃에서 개선 소멸(평균 회귀) — 튠 성과는 선택 편향/우연"
    )
    report(0.98, "finalize")
    return {
        "candidates": cand_metrics,
        "best_params": best,
        "metrics_tune": metrics_tune,
        "metrics_holdout": metrics_hold,
        "h0_benchmark": h0,
    }


# ---------------------------------------------------------------- 조회·계보·활성화


def latest_experiment(session: Session, strategy: str) -> Experiment | None:
    return session.scalars(
        select(Experiment)
        .where(Experiment.strategy == strategy, Experiment.status == "done")
        .order_by(Experiment.iteration.desc(), Experiment.created_at.desc())
        .limit(1)
    ).first()


def list_experiments(session: Session, strategy: str | None = None, limit: int = 100) -> list[Experiment]:
    stmt = select(Experiment)
    if strategy:
        stmt = stmt.where(Experiment.strategy == strategy)
    return list(session.scalars(stmt.order_by(Experiment.created_at.desc()).limit(limit)).all())


def active_experiment(session: Session, strategy: str) -> Experiment | None:
    return session.scalars(
        select(Experiment).where(Experiment.strategy == strategy, Experiment.is_active.is_(True)).limit(1)
    ).first()


def active_params(session: Session, strategy: str) -> tuple[dict, Experiment | None]:
    e = active_experiment(session, strategy)
    return (dict(e.params) if e else strat.default_params(strategy)), e


def activate(session: Session, experiment_id: str) -> Experiment:
    e = session.get(Experiment, experiment_id)
    if e is None:
        raise ValueError("실험 없음")
    if e.status != "done":
        raise ValueError("완료된 실험만 활성화 가능")
    for other in session.scalars(
        select(Experiment).where(Experiment.strategy == e.strategy, Experiment.is_active.is_(True))
    ).all():
        other.is_active = False
    e.is_active = True
    session.commit()
    return e


def deactivate(session: Session, strategy: str) -> None:
    for other in session.scalars(
        select(Experiment).where(Experiment.strategy == strategy, Experiment.is_active.is_(True))
    ).all():
        other.is_active = False
    session.commit()


def lineage(session: Session, strategy: str) -> dict:
    """세대별 홀드아웃 성과 추이 + 지속 개선 검정 (Spearman, 누적 홀드아웃 z)."""
    rows = [
        e
        for e in session.scalars(
            select(Experiment)
            .where(Experiment.strategy == strategy, Experiment.status == "done")
            .order_by(Experiment.iteration.asc(), Experiment.created_at.asc())
        ).all()
    ]
    pts = []
    cum_m = cum_n = 0.0
    var = hypergeom_match_var(GAME)
    for e in rows:
        mh = e.metrics_holdout or {}
        mt = e.metrics_tune or {}
        n = mh.get("n_tickets") or 0
        if n:
            cum_m += (mh.get("mean_matches") or 0) * n
            cum_n += n
        pts.append(
            {
                "experiment_id": e.experiment_id,
                "iteration": e.iteration,
                "created_at": to_iso(e.created_at),
                "params": e.params,
                "is_active": e.is_active,
                "tune_diff": (mt.get("diff_vs_uniform") or {}).get("mean"),
                "tune_mean": mt.get("mean_matches"),
                "holdout_diff": (mh.get("diff_vs_uniform") or {}).get("mean"),
                "holdout_ci95": (mh.get("diff_vs_uniform") or {}).get("ci95"),
                "holdout_mean": mh.get("mean_matches"),
                "holdout_z": mh.get("z"),
                "optimism": mh.get("optimism"),
                "p_best_of_k": (e.h0_benchmark or {}).get("p_best_of_k"),
                "cum_holdout_mean": (cum_m / cum_n) if cum_n else None,
                "cum_holdout_z": float(((cum_m / cum_n) - GAME.expected_overlap) / np.sqrt(var / cum_n))
                if cum_n
                else None,
            }
        )
    trend = None
    hm = [(p["iteration"], p["holdout_mean"]) for p in pts if p["holdout_mean"] is not None]
    if len(hm) >= 4:
        r = stats.spearmanr([a for a, _ in hm], [b for _, b in hm])
        trend = {
            "spearman_rho": float(r.statistic),
            "p": float(r.pvalue),
            "n": len(hm),
            "verdict": "세대에 걸친 유의한 상승"
            if r.pvalue < 0.05 and r.statistic > 0
            else "유의한 추세 없음 (공정 추첨과 일치)",
        }
    return {
        "strategy": strategy,
        "points": pts,
        "trend": trend,
        "note": (
            "홀드아웃 성과가 세대에 걸쳐 0.8(균등) 근처에서 등락하면 A 분석 기반 개선은 우연 변동. "
            "유의한 상승이 지속될 때만 '유의미한 변화'."
        ),
    }


def e_to_dict(e: Experiment) -> dict:
    return {
        "experiment_id": e.experiment_id,
        "name": e.name,
        "strategy": e.strategy,
        "params": e.params,
        "parent_id": e.parent_id,
        "iteration": e.iteration,
        "tune_from": e.tune_from,
        "tune_to": e.tune_to,
        "holdout_from": e.holdout_from,
        "holdout_to": e.holdout_to,
        "n_tickets": e.n_tickets,
        "seed": e.seed,
        "search": e.search,
        "n_candidates": e.n_candidates,
        "candidates": e.candidates,
        "metrics_tune": e.metrics_tune,
        "metrics_holdout": e.metrics_holdout,
        "h0_benchmark": e.h0_benchmark,
        "status": e.status,
        "progress": e.progress,
        "stage": e.stage,
        "error": e.error,
        "is_active": e.is_active,
        "created_at": to_iso(e.created_at),
        "finished_at": to_iso(e.finished_at),
    }
