"""검증 (PRD §E3, 사용자 지시 2): 군 A 결과의 군 B 재현성·동질성, 1001~1240 replay backtest, 스코어링 규칙."""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime

import numpy as np
from scipy import stats
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import frequency, pairs
from app.core.config import settings
from app.core.data_io import load_source_file
from app.core.features import incidence_from_draws
from app.core.null_model import GAME
from app.core.recommend import strategies as strat
from app.core.recommend.scorecard import hypergeom_match_var
from app.core.timeutil import to_iso
from app.db.base import SessionLocal
from app.db.models import Draw, Recommendation, TicketOutcome, ValidationResult, ValidationRun
from app.services import analysis_service as asvc
from app.services.draws import load_draws, max_draw_no
from app.services.import_service import apply_records
from app.services.tracking_service import evaluate_ticket

DEFAULT_STRATEGIES = list(strat.STRATEGIES.keys())


def create_validation(session: Session, params: dict) -> ValidationRun:
    v = ValidationRun(validation_id=str(uuid.uuid4()), run_id_a=params.get("run_id_a"), params=params, status="pending")
    session.add(v)
    session.commit()
    return v


def start_background(validation_id: str) -> None:
    threading.Thread(target=execute_validation, args=(validation_id,), daemon=True).start()


def _upd(session: Session, v: ValidationRun, p: float, stage: str) -> None:
    v.progress, v.stage = float(p), stage
    session.commit()


def _source_draws_b(session: Session, lo: int, hi: int) -> tuple[np.ndarray, list]:
    """군 B 실데이터: DB 에 있으면 DB, 없으면 원천 xlsx 에서. 반환 (draw_no 배열, records/rows)."""
    rep = load_source_file(settings.source_file_path, pool_size=GAME.N, main_count=GAME.k)
    recs = [r for r in rep.records if lo <= r.draw_no <= hi]
    return np.array([r.draw_no for r in recs]), recs


def execute_validation(validation_id: str) -> None:
    with SessionLocal() as session:
        v = session.get(ValidationRun, validation_id)
        if v is None:
            return
        try:
            v.status = "running"
            _upd(session, v, 0.0, "prepare")
            params = v.params
            results = run_validation(session, params, lambda p, s: _upd(session, v, p, s))
            session.execute(delete(ValidationResult).where(ValidationResult.validation_id == validation_id))
            for kind, payload in results.items():
                session.add(ValidationResult(validation_id=validation_id, kind=kind, payload=payload))
            v.status, v.finished_at = "done", datetime.now(UTC)
            _upd(session, v, 1.0, "done")
        except Exception as e:  # noqa: BLE001
            session.rollback()
            v = session.get(ValidationRun, validation_id)
            if v is not None:
                v.status, v.error, v.finished_at = "error", f"{type(e).__name__}: {e}", datetime.now(UTC)
                session.commit()


def run_validation(session: Session, params: dict, report) -> dict:  # noqa: ANN001
    strategies: list[str] = params.get("strategies") or DEFAULT_STRATEGIES
    n_tickets: int = int(params.get("tickets_per_draw") or settings.lotto_number_recommendation_count)
    from_draw: int = int(params.get("from_draw") or settings.lotto_train_end_draw + 1)
    to_draw: int = int(params.get("to_draw") or 10**9)
    seed: int = int(params.get("seed") or settings.lotto_random_seed)
    insert_draws: bool = bool(params.get("insert_draws", True))
    alpha = settings.lotto_significance_level

    # --- 군 B 실데이터 확보 ---
    b_draw_nos, b_recs = _source_draws_b(session, from_draw, to_draw)
    if len(b_recs) == 0:
        raise ValueError("검증 구간 데이터 없음 (원천 xlsx 확인)")
    to_draw = int(b_draw_nos.max())
    # --- 군 A run (winners model 등) ---
    run_a = None
    if params.get("run_id_a"):
        run_a = asvc.get_run(session, params["run_id_a"])
    if run_a is None:
        run_a = asvc.latest_done_run(session, "A")
    wm = asvc.get_section(session, run_a.run_id, "winners_model") if run_a else None
    nf = asvc.get_null_features(seed)

    # --- 1) replay backtest ---
    report(0.05, "backtest")
    hist = load_draws(session, 1, from_draw - 1)  # DB 이력(군 A + 이미 삽입된 B 앞부분)
    hist_main = hist.main.copy()
    x_hist = incidence_from_draws(hist_main, GAME.N) if len(hist_main) else np.zeros((0, GAME.N), dtype=np.int8)
    # 이미 DB 에 있는 B 회차는 replay 이력에서 제외 → 순차 재구성 (엄격한 look-ahead 방지)
    hist_mask = hist.draw_no < from_draw
    x_hist = x_hist[hist_mask]
    hist_main = hist_main[hist_mask]

    batch_id = str(uuid.uuid4())
    outcomes: dict[str, list[dict]] = {s: [] for s in strategies}
    scoring: dict[str, list[tuple[float, float]]] = {s: [] for s in strategies}  # (brier, log)
    unif_p = np.full(GAME.N, GAME.p_single)
    new_outcome_rows: list[TicketOutcome] = []
    new_rec_rows: list[Recommendation] = []
    existing_draws = set(session.scalars(select(Draw.draw_no).where(Draw.draw_no >= from_draw)).all())
    # 이전 replay 결과 정리(같은 구간 재실행 시 중복 방지)
    session.execute(delete(TicketOutcome).where(TicketOutcome.origin == "backtest"))
    session.execute(delete(Recommendation).where(Recommendation.origin == "backtest"))
    session.flush()

    for idx, rec in enumerate(b_recs):
        t = rec.draw_no
        ctx = strat.Context(incidence=x_hist, draw_no_next=t, game=GAME, winners_model=wm, null_features=nf)
        y = np.zeros(GAME.N)
        y[[n - 1 for n in rec.numbers]] = 1
        draw_obj = Draw(**rec.as_dict())
        for si, s in enumerate(strategies):
            tickets, _meta = strat.generate(s, ctx, n_tickets, seed + 1000 * si + t, None)
            pvec = strat.probability_vector(ctx, s)
            brier = float(np.mean((pvec - y) ** 2))
            logs = float(np.sum(y * np.log(pvec) + (1 - y) * np.log(1 - pvec)))
            scoring[s].append((brier, logs))
            for tk in tickets:
                m, b, r, prize = evaluate_ticket(tk, draw_obj)
                outcomes[s].append({"draw_no": t, "ticket": tk, "matches": m, "bonus": b, "rank": r, "prize": prize})
                rrow = Recommendation(
                    batch_id=batch_id,
                    run_id=run_a.run_id if run_a else None,
                    strategy=s,
                    params={"count": n_tickets, "backtest": True},
                    seed=seed + 1000 * si + t,
                    ticket=tk,
                    scorecard={},
                    target_draw_no=t,
                    origin="backtest",
                )
                new_rec_rows.append(rrow)
                new_outcome_rows.append(
                    TicketOutcome(
                        source="recommendation",
                        ticket_ref=0,
                        strategy=s,
                        origin="backtest",
                        draw_no=t,
                        ticket=tk,
                        main_matches=m,
                        bonus_match=b,
                        rank=r,
                        prize_amount=prize,
                    )
                )
        # 이력 확장 (t 를 본 뒤에만)
        x_hist = np.vstack([x_hist, incidence_from_draws(np.array([rec.numbers]), GAME.N)])
        hist_main = np.vstack([hist_main, np.array([rec.numbers])]) if len(hist_main) else np.array([rec.numbers])
        if idx % 10 == 0:
            report(0.05 + 0.6 * (idx + 1) / len(b_recs), f"backtest {t}")
    # 저장 (rec_id 연결)
    for rr in new_rec_rows:
        session.add(rr)
    session.flush()
    for rr, oo in zip(new_rec_rows, new_outcome_rows, strict=True):
        oo.ticket_ref = rr.rec_id
        session.add(oo)
    session.flush()
    # 군 B 실데이터 DB 삽입 (성과추적·ALL 분석용) — 훅 미실행
    inserted_b = 0
    if insert_draws:
        from app.core.data_io import ParseReport

        rep = ParseReport(
            records=[r for r in b_recs if r.draw_no not in existing_draws],
            invalid=[],
            data_hash=f"validation-{from_draw}-{to_draw}",
            columns=[],
        )
        res = apply_records(
            session,
            rep,
            f"validation-replay:{from_draw}-{to_draw}",
            source="backtest_replay",
            run_hooks=False,
            trigger="validation",
        )
        inserted_b = res.inserted

    report(0.7, "backtest_summary")
    backtest = _summarize_backtest(outcomes, n_tickets, len(b_recs))
    scoring_out = _summarize_scoring(scoring, len(b_recs), unif_p, GAME.N)

    # --- 2) 재현성 & 동질성 (군 A run vs 군 B 데이터) ---
    report(0.8, "replication")
    xb_full = incidence_from_draws(np.array([r.numbers for r in b_recs]), GAME.N)
    xa = incidence_from_draws(hist.main[hist.draw_no <= settings.lotto_train_end_draw], GAME.N)
    replication = _replication(session, run_a, xa, xb_full, alpha)
    homogeneity = _homogeneity(xa, xb_full)

    report(0.95, "finalize")
    meta = {
        "from_draw": from_draw,
        "to_draw": to_draw,
        "n_draws_b": len(b_recs),
        "tickets_per_draw": n_tickets,
        "strategies": strategies,
        "seed": seed,
        "run_id_a": run_a.run_id if run_a else None,
        "batch_id": batch_id,
        "inserted_b_draws": inserted_b,
        "winners_model_used": bool(wm and "coef" in wm),
        "policy": "각 회차 t 의 추천은 t-1 까지 이력만 사용(look-ahead 금지). 모든 전략의 이론 당첨확률 동일.",
    }
    return {
        "meta": meta,
        "backtest": backtest,
        "scoring": scoring_out,
        "replication": replication,
        "homogeneity": homogeneity,
    }


def _summarize_backtest(outcomes: dict[str, list[dict]], n_tickets: int, n_draws: int) -> dict:
    game = GAME
    md = game.match_distribution()
    var = hypergeom_match_var(game)
    rp = game.rank_probabilities()
    out: dict = {"strategies": {}, "comparison_vs_uniform": {}}
    per_draw_mean: dict[str, dict[int, float]] = {}
    for s, rows in outcomes.items():
        n = len(rows)
        m = np.array([r["matches"] for r in rows], dtype=float)
        mean = float(m.mean()) if n else None
        z = float((float(m.mean()) - game.expected_overlap) / np.sqrt(var / n)) if n else None
        ge3 = int((m >= 3).sum())
        pd: dict[int, list[float]] = {}
        for r in rows:
            pd.setdefault(r["draw_no"], []).append(r["matches"])
        per_draw_mean[s] = {d: float(np.mean(v)) for d, v in pd.items()}
        cum_o = np.cumsum([sum(pd[d]) for d in sorted(pd)])
        cum_e = np.cumsum([len(pd[d]) * game.expected_overlap for d in sorted(pd)])
        prize = int(sum(r["prize"] for r in rows))
        out["strategies"][s] = {
            "label": strat.STRATEGIES[s]["label"],
            "n_tickets": n,
            "n_draws": n_draws,
            "match_hist": [int((m == i).sum()) for i in range(game.k + 1)],
            "match_hist_expected": (md * n).round(2).tolist(),
            "mean_matches": mean,
            "expected_matches": game.expected_overlap,
            "z": z,
            "p": float(2 * stats.norm.sf(abs(z))) if z is not None else None,
            "n_ge3": ge3,
            "expected_ge3": float(md[3:].sum() * n),
            "p_ge3_binomial": float(stats.binomtest(ge3, n, float(md[3:].sum())).pvalue) if n else None,
            "rank_counts": {f"rank{k}": int(sum(1 for r in rows if r["rank"] == k)) for k in range(1, 6)},
            "rank_expected": {f"rank{k}": float(rp[f"rank{k}"] * n) for k in range(1, 6)},
            "total_prize": prize,
            "total_cost": n * 1000,
            "roi": (prize - n * 1000) / (n * 1000) if n else None,
            "max_matches": int(m.max()) if n else None,
            "p_max_matches_null": float(1 - (1 - md[int(m.max()) :].sum()) ** n) if n else None,
            "curve": [
                {"draw_no": d, "cum_matches": float(o), "cum_expected": float(e)}
                for d, o, e in zip(sorted(pd), cum_o, cum_e, strict=True)
            ],
        }
    ctrl = per_draw_mean.get("uniform")
    if ctrl:
        rng = np.random.default_rng(0)
        for s, pdm in per_draw_mean.items():
            if s == "uniform":
                continue
            common = sorted(set(ctrl) & set(pdm))
            diff = np.array([pdm[d] - ctrl[d] for d in common])
            boots = np.array([rng.choice(diff, len(diff)).mean() for _ in range(3000)])
            lo, hi = float(np.quantile(boots, 0.025)), float(np.quantile(boots, 0.975))
            out["comparison_vs_uniform"][s] = {
                "n_draws": len(common),
                "mean_diff": float(diff.mean()),
                "ci95": [lo, hi],
                "p_paired_t": float(stats.ttest_1samp(diff, 0).pvalue) if len(diff) > 2 else None,
                "verdict": "균등 대비 유의한 개선"
                if lo > 0
                else ("균등 대비 유의한 저하" if hi < 0 else "균등과 차이 없음"),
            }
    return out


def _summarize_scoring(scoring: dict[str, list[tuple[float, float]]], n_draws: int, unif_p: np.ndarray, N: int) -> dict:
    out: dict[str, object] = {}
    base = np.array(scoring.get("uniform", [])) if "uniform" in scoring else None
    rng = np.random.default_rng(1)
    for s, vals in scoring.items():
        a = np.array(vals)
        row: dict[str, object] = {
            "brier_mean": float(a[:, 0].mean()),
            "log_score_mean": float(a[:, 1].mean()),
            "n_draws": len(a),
        }
        if base is not None and len(base) == len(a) and s != "uniform":
            db = a[:, 0] - base[:, 0]
            dl = a[:, 1] - base[:, 1]
            bb = np.array([rng.choice(db, len(db)).mean() for _ in range(2000)])
            bl = np.array([rng.choice(dl, len(dl)).mean() for _ in range(2000)])
            row["brier_diff_vs_uniform"] = {
                "mean": float(db.mean()),
                "ci95": [float(np.quantile(bb, 0.025)), float(np.quantile(bb, 0.975))],
                "better": bool(np.quantile(bb, 0.975) < 0),
            }
            row["log_diff_vs_uniform"] = {
                "mean": float(dl.mean()),
                "ci95": [float(np.quantile(bl, 0.025)), float(np.quantile(bl, 0.975))],
                "better": bool(np.quantile(bl, 0.025) > 0),
            }
        out[s] = row
    out["_note"] = "Brier↓·log↑ 가 좋음. 균등 예보 대비 CI 가 0 을 포함하면 예측력 차이 없음 (Gneiting & Raftery 2007)."
    return out


def _replication(session: Session, run_a, xa: np.ndarray, xb: np.ndarray, alpha: float) -> dict:  # noqa: ANN001
    """군 A 에서 (보정 전/후) 유의한 번호·쌍이 군 B 에서 같은 방향으로 재현되는가 + H0 기대 재현율."""
    Tb = xb.shape[0]
    fa = frequency.number_frequency(xa, "main", GAME, alpha)
    fb = frequency.number_frequency(xb, "main", GAME, alpha)
    pa = pairs.pair_analysis(xa, GAME, alpha, 0.25)
    pb = pairs.pair_analysis(xb, GAME, alpha, 0.25)

    # 후보: A 에서 원시 p<0.05 (탐색 후보) & BH 유의
    def _rep(rows_a: list[dict], rows_b: list[dict], key) -> dict:  # noqa: ANN001
        idx_b = {key(r): r for r in rows_b}
        cand = [r for r in rows_a if r["p"] < 0.05]
        sig = [r for r in rows_a if r.get("sig_bh")]
        same_dir = [r for r in cand if np.sign(idx_b[key(r)]["z"]) == np.sign(r["z"]) and idx_b[key(r)]["p"] < 0.05]
        detail = [
            {
                "key": key(r),
                "z_a": r["z"],
                "p_a": r["p"],
                "z_b": idx_b[key(r)]["z"],
                "p_b": idx_b[key(r)]["p"],
                "replicated": bool(np.sign(idx_b[key(r)]["z"]) == np.sign(r["z"]) and idx_b[key(r)]["p"] < 0.05),
            }
            for r in sorted(cand, key=lambda r: r["p"])[:50]
        ]
        return {
            "n_candidates_a_raw": len(cand),
            "n_sig_bh_a": len(sig),
            "n_replicated_same_dir_p05": len(same_dir),
            "replication_rate": len(same_dir) / len(cand) if cand else None,
            "expected_rate_under_h0": 0.025,
            "detail": detail,
        }

    rep_num = _rep(fa["rows"], fb["rows"], lambda r: r["number"])
    rep_pair = _rep(pa["rows"], pb["rows"], lambda r: (r["a"], r["b"]))
    for r in rep_pair["detail"]:
        r["key"] = list(r["key"])
    # Lift* 벡터 상관 A vs B (H0 기대 0)
    la = np.array([r["calibrated_lift"] for r in pa["rows"]])
    lb = np.array([r["calibrated_lift"] for r in pb["rows"]])
    za = np.array([r["z"] for r in fa["rows"]])
    zb = np.array([r["z"] for r in fb["rows"]])
    return {
        "numbers": rep_num,
        "pairs": rep_pair,
        "pair_lift_corr_a_b": {
            "r": float(np.corrcoef(la, lb)[0, 1]),
            "p": float(stats.pearsonr(la, lb).pvalue),
            "expected": 0.0,
        },
        "number_z_corr_a_b": {
            "r": float(np.corrcoef(za, zb)[0, 1]),
            "p": float(stats.pearsonr(za, zb).pvalue),
            "expected": 0.0,
        },
        "T_a": int(xa.shape[0]),
        "T_b": int(Tb),
        "run_id_a": run_a.run_id if run_a else None,
        "note": "재현율이 H0 기대(≈2.5%: 같은 방향 & p<.05)와 다르지 않으면 A 의 '유의' 패턴은 우연 변동.",
    }


def _homogeneity(xa: np.ndarray, xb: np.ndarray) -> dict:
    """A vs B 번호 빈도 동질성 — 2×N 분할표 χ² (비복원 보정 J 계수 적용) + MC 는 생략(점근)."""
    ca, cb = xa.sum(axis=0).astype(float), xb.sum(axis=0).astype(float)
    table = np.vstack([ca, cb])
    chi2, p, dof, _ = stats.chi2_contingency(table, correction=False)
    J = GAME.joe_factor * chi2
    pj = float(stats.chi2.sf(J, dof))
    return {
        "chi2": float(chi2),
        "df": int(dof),
        "p_naive": float(p),
        "chi2_adjusted": float(J),
        "p_adjusted": pj,
        "counts_a": ca.astype(int).tolist(),
        "counts_b": cb.astype(int).tolist(),
        "verdict": "동질(차이 없음)" if pj >= 0.05 else "빈도 분포 차이 유의",
    }


# 조회
def get_validation(session: Session, validation_id: str) -> ValidationRun | None:
    return session.get(ValidationRun, validation_id)


def get_kind(session: Session, validation_id: str, kind: str) -> dict | None:
    r = session.scalar(
        select(ValidationResult).where(ValidationResult.validation_id == validation_id, ValidationResult.kind == kind)
    )
    return None if r is None else r.payload


def list_validations(session: Session, limit: int = 20) -> list[ValidationRun]:
    return list(session.scalars(select(ValidationRun).order_by(ValidationRun.created_at.desc()).limit(limit)).all())


def latest_done(session: Session) -> ValidationRun | None:
    return session.scalars(
        select(ValidationRun).where(ValidationRun.status == "done").order_by(ValidationRun.created_at.desc()).limit(1)
    ).first()


def v_to_dict(v: ValidationRun) -> dict:
    return {
        "validation_id": v.validation_id,
        "run_id_a": v.run_id_a,
        "params": v.params,
        "status": v.status,
        "progress": v.progress,
        "stage": v.stage,
        "error": v.error,
        "created_at": to_iso(v.created_at),
        "finished_at": to_iso(v.finished_at),
    }


__all__ = [
    "create_validation",
    "start_background",
    "execute_validation",
    "get_validation",
    "get_kind",
    "list_validations",
    "latest_done",
    "v_to_dict",
    "max_draw_no",
]
