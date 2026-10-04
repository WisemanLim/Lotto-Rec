"""분석 run 관리 — 파이프라인 실행(백그라운드 스레드), 진행률, 섹션별 결과 저장, 자동 재실행 훅.

(S2.14) 서버 재기동으로 스레드가 사라진 run 은 시작 시 `interrupted` 로 표시하고, MC 체크포인트
(`<cache>/runs/<run_id>.mc.npz`)부터 같은 run_id 로 이어서 실행한다(자동 또는 `resume_run`).
"""

from __future__ import annotations

import platform
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import cross_draw, frequency, groups, itemsets, order_stats, pairs, temporal, winners_model
from app.core.config import settings
from app.core.mc_engine import NullDistributions, run_null_simulation
from app.core.null_model import GAME
from app.core.timeutil import to_iso
from app.db.base import SessionLocal
from app.db.models import AnalysisResult, AnalysisRun
from app.services.draws import DrawSet, cohort_range, load_draws, max_draw_no

PRESET_ITER = {
    "quick": lambda: settings.lotto_mc_iterations,
    "report": lambda: settings.lotto_mc_iterations_report,
    "deep": lambda: settings.lotto_mc_iterations_deep,
}
SECTIONS = [
    "summary",
    "frequency",
    "frequency_bonus",
    "global",
    "pairs",
    "itemsets",
    "groups",
    "temporal",
    "cross_draw",
    "network",
    "winners_model",
    "null_summary",
    "diff_vs_previous",
]

_lock = threading.Lock()
_active: dict[str, threading.Thread] = {}
CHECKPOINT_DIR: Path | None = None  # None → settings.cache_dir_path / "runs" (테스트는 임시 경로로 치환)
INTERRUPTED_STAGE = "서버 재기동으로 중단됨 — 이어서 실행 가능"
_null_feature_cache: dict[int, np.ndarray] = {}


def get_null_features(seed: int | None = None, n: int = 200_000) -> np.ndarray:
    """균등 조합 특성 영분포 — 메모리 + Parquet 캐시."""
    seed = settings.lotto_random_seed if seed is None else seed
    if seed in _null_feature_cache:
        return _null_feature_cache[seed]
    cache_dir: Path = settings.cache_dir_path
    cache_dir.mkdir(parents=True, exist_ok=True)
    f = cache_dir / f"null_features_s{seed}_n{n}.npy"
    if f.exists():
        arr = np.load(f)
    else:
        arr = groups.null_feature_sample(seed, n, GAME)
        np.save(f, arr)
    _null_feature_cache[seed] = arr
    return arr


def _versions() -> dict:
    import numpy
    import scipy
    import statsmodels

    return {
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "scipy": scipy.__version__,
        "statsmodels": statsmodels.__version__,
    }


def _data_hash(ds: DrawSet) -> str:
    import hashlib

    h = hashlib.sha256(ds.main.tobytes() + ds.bonus.tobytes()).hexdigest()
    return h[:16]


def create_run(
    session: Session,
    *,
    cohort: str = "A",
    preset: str = "quick",
    alpha: float | None = None,
    correction: str | None = None,
    seed: int | None = None,
    mc_iterations: int | None = None,
    trigger: str = "manual",
    draw_to: int | None = None,
) -> AnalysisRun:
    mx = max_draw_no(session)
    if mx is None:
        raise ValueError("적재된 회차가 없습니다")
    lo, hi = cohort_range(cohort, mx)
    hi = mx if hi is None else min(hi, mx)
    if draw_to is not None:
        hi = min(hi, draw_to)
    ds = load_draws(session, lo, hi)
    if ds.T < 10:
        raise ValueError(f"분석 회차 부족 ({ds.T}회)")
    run = AnalysisRun(
        run_id=str(uuid.uuid4()),
        cohort=cohort,
        draw_from=int(ds.draw_no.min()),
        draw_to=int(ds.draw_no.max()),
        n_draws=ds.T,
        preset=preset,
        alpha=settings.lotto_significance_level if alpha is None else alpha,
        correction=correction or settings.lotto_default_correction,
        mc_iterations=mc_iterations or PRESET_ITER.get(preset, PRESET_ITER["quick"])(),
        seed=settings.lotto_random_seed if seed is None else seed,
        data_hash=_data_hash(ds),
        versions=_versions(),
        status="pending",
        trigger=trigger,
    )
    session.add(run)
    session.commit()
    return run


def checkpoint_path(run_id: str) -> Path:
    base = CHECKPOINT_DIR if CHECKPOINT_DIR is not None else settings.cache_dir_path / "runs"
    return base / f"{run_id}.mc.npz"


def discard_checkpoint(run_id: str) -> None:
    checkpoint_path(run_id).unlink(missing_ok=True)


def start_run_background(run_id: str) -> None:
    th = threading.Thread(target=execute_run, args=(run_id,), daemon=True, name=f"run-{run_id[:8]}")
    with _lock:
        _active[run_id] = th
    th.start()


def is_active(run_id: str) -> bool:
    with _lock:
        th = _active.get(run_id)
    return th is not None and th.is_alive()


def mark_interrupted_runs(session: Session) -> list[str]:
    """이 프로세스에서 실행 중이 아닌 pending/running run 을 `interrupted` 로 바꾼다(서버 시작 시 호출)."""
    ids: list[str] = []
    for run in session.scalars(select(AnalysisRun).where(AnalysisRun.status.in_(("pending", "running")))):
        if is_active(run.run_id):
            continue
        run.status = "interrupted"
        run.stage = INTERRUPTED_STAGE
        ids.append(run.run_id)
    session.commit()
    return ids


def resume_run(session: Session, run_id: str) -> AnalysisRun:
    """`interrupted` run 을 같은 run_id 로 이어서 실행(백그라운드). ValueError=상태 불가, LookupError=없음."""
    run = session.get(AnalysisRun, run_id)
    if run is None:
        raise LookupError("run 없음")
    if run.status != "interrupted" or is_active(run_id):
        raise ValueError(f"이어서 실행할 수 없는 상태입니다: {run.status} (중단된 run 만 가능)")
    run.status = "pending"
    run.stage = "resume"
    session.commit()
    start_run_background(run_id)
    return run


def resume_interrupted_runs() -> list[str]:
    """서버 시작 훅: 중단 감지 후 `LOTTO_AUTO_RESUME_RUNS` 면 자동 재개. 재개(또는 표시)한 run_id 목록 반환."""
    with SessionLocal() as session:
        ids = mark_interrupted_runs(session)
        if settings.lotto_auto_resume_runs:
            for rid in ids:
                resume_run(session, rid)
    return ids


def _update(session: Session, run: AnalysisRun, progress: float, stage: str) -> None:
    run.progress = float(progress)
    run.stage = stage
    session.commit()


def execute_run(run_id: str) -> None:
    """동기 실행 (테스트/백그라운드 공용)."""
    with SessionLocal() as session:
        run = session.get(AnalysisRun, run_id)
        if run is None:
            return
        try:
            run.status = "running"
            _update(session, run, 0.0, "load")
            ds = load_draws(session, run.draw_from, run.draw_to)
            results = compute_all(ds, run, lambda p, s: _update(session, run, p, s), checkpoint=checkpoint_path(run_id))
            session.execute(delete(AnalysisResult).where(AnalysisResult.run_id == run_id))
            prev = previous_done_run(session, run)
            results["diff_vs_previous"] = (
                diff_runs(session, prev, results)
                if prev
                else {
                    "previous_run_id": None,
                    "summary": "이전 run 없음 (첫 분석)",
                }
            )
            for sec, payload in results.items():
                session.add(AnalysisResult(run_id=run_id, section=sec, payload=payload))
            run.status = "done"
            run.finished_at = datetime.now(UTC)
            _update(session, run, 1.0, "done")
            discard_checkpoint(run_id)
            prune_runs(session)
        except Exception as e:  # noqa: BLE001
            session.rollback()
            run = session.get(AnalysisRun, run_id)
            if run is not None:
                run.status = "error"
                run.error = f"{type(e).__name__}: {e}"
                run.finished_at = datetime.now(UTC)
                session.commit()
            discard_checkpoint(run_id)
        finally:
            with _lock:
                _active.pop(run_id, None)


def compute_all(ds: DrawSet, run: AnalysisRun, report, checkpoint: Path | None = None) -> dict:  # noqa: ANN001
    alpha = run.alpha
    x = ds.incidence
    xb = ds.bonus_incidence
    T = ds.T

    report(0.02, "monte_carlo")
    nd: NullDistributions = run_null_simulation(
        T,
        run.mc_iterations,
        run.seed,
        GAME,
        chunk=64,
        progress=lambda f: report(0.02 + 0.55 * f, f"monte_carlo {int(f * 100)}%"),
        cross_max_lag=settings.lotto_cross_draw_lag,
        checkpoint=checkpoint,
    )
    report(0.6, "frequency")
    freq = frequency.number_frequency(x, "main", GAME, alpha)
    freq_b = frequency.number_frequency(xb, "bonus", GAME, alpha)
    glob = frequency.global_uniformity(x, GAME, nd.x2_single)
    glob["order_stat_Q"] = order_stats.order_stat_test(ds.main, GAME, nd.q_order)
    glob["max_abs_z_single"] = {
        "observed": freq["max_abs_z"],
        "number": freq["argmax_number"],
        "p_maxT": float(np.mean(nd.max_abs_z_single >= freq["max_abs_z"])),
    }
    report(0.68, "pairs")
    pr = pairs.pair_analysis(x, GAME, alpha, settings.lotto_min_effect_delta, nd.max_abs_z_pair, nd.genest_x2)
    report(0.78, "itemsets")
    its = itemsets.candidate_triples(pr["rows"], x, GAME, alpha, top_pairs=20, N=GAME.N)
    its["size_expectations"] = itemsets.all_size_expectations(T, GAME)
    report(0.83, "groups")
    nf = get_null_features(run.seed)
    grp = groups.group_analysis(ds.main, GAME, nf)
    report(0.88, "temporal")
    tmp = temporal.temporal_analysis(
        x, ds.main, ds.draw_no, GAME, alpha, 10, nd.overlap_mean, nd.max_abs_lag1, nd.cusum_max
    )
    report(0.92, "cross_draw")
    cd = cross_draw.cross_draw_analysis(x, ds.draw_no, settings.lotto_cross_draw_lag, GAME, alpha, nd.max_abs_z_cross)
    report(0.95, "winners_model")
    try:
        wm = winners_model.fit_winners_model(
            ds.main, ds.draw_no, ds.winners1, ref_draw=float(settings.lotto_train_end_draw)
        )
    except Exception as e:  # noqa: BLE001
        wm = {"error": str(e)}
    report(0.98, "summary")
    summary = {
        "run_id": run.run_id,
        "cohort": run.cohort,
        "draw_from": run.draw_from,
        "draw_to": run.draw_to,
        "T": T,
        "N": GAME.N,
        "k": GAME.k,
        "slots": T * GAME.k,
        "alpha": alpha,
        "correction": run.correction,
        "mc_iterations": run.mc_iterations,
        "seed": run.seed,
        "kpi": {
            "global_p_joe": glob["joe_J"]["p_asymptotic"],
            "global_p_mc": glob["pearson_x2"].get("p_mc"),
            "order_stat_p": glob["order_stat_Q"].get("p_mc", glob["order_stat_Q"]["p_asymptotic"]),
            "n_sig_numbers_bh": freq["n_sig_bh"],
            "n_sig_numbers_holm": freq["n_sig_holm"],
            "n_sig_pairs_bh": pr["summary"]["n_sig_bh"],
            "n_sig_pairs_fwer": pr["summary"]["n_sig_fwer"],
            "max_pair": pr["summary"]["max_pair"],
            "max_pair_z": pr["summary"]["max_abs_z"],
            "max_pair_p_maxT": pr["summary"]["max_pair_p_maxT"],
            "genest_p_mc": pr["summary"]["genest"].get("p_mc"),
            "temporal_alerts": tmp["alerts"],
            "overlap_mean": tmp["overlap"]["mean"],
            "cusum_p_mc": tmp["changepoint"].get("cusum_p_mc"),
            "cross_draw_lag": cd["max_lag"],
            "cross_draw_max_cell": cd["window"]["summary"]["max_cell"],
            "cross_draw_max_z": cd["window"]["summary"]["max_abs_z"],
            "cross_draw_p_maxT": cd["window"]["summary"]["max_cell_p_maxT"],
            "cross_draw_any_lag_p_maxT": None if cd["any_lag"] is None else cd["any_lag"]["p_maxT"],
            "cross_draw_n_sig_bh": cd["window"]["summary"]["n_sig_bh"],
            "cross_draw_alerts": cd["alerts"],
        },
        "verdict": _verdict(glob, pr, tmp, alpha, cd),
        "interpretation_policy": [
            "공정 추첨에서도 번호쌍 상관은 구조적으로 음수(-1/44)입니다.",
            "보정 전 p<0.05 는 탐색 후보입니다. 990쌍 탐색 시 약 50개의 우연 후보가 정상입니다.",
            "통계적 유의성은 예측력·조작·인과의 증거가 아닙니다.",
        ],
    }
    return {
        "summary": summary,
        "frequency": freq,
        "frequency_bonus": freq_b,
        "global": glob,
        "pairs": {"summary": pr["summary"], "rows": pr["rows"], "matrix": pr["matrix"], "z_matrix": pr["z_matrix"]},
        "network": pr["network"],
        "itemsets": its,
        "groups": grp,
        "temporal": tmp,
        "cross_draw": cd,
        "winners_model": wm,
        "null_summary": nd.summary(),
    }


def _verdict(glob: dict, pr: dict, tmp: dict, alpha: float, cd: dict | None = None) -> dict:
    flags = []
    if glob["joe_J"]["p_asymptotic"] < alpha:
        flags.append("전역 균등성(J) 유의")
    if glob["order_stat_Q"].get("p_mc", 1) < alpha:
        flags.append("순서통계량 Q 유의")
    if (pr["summary"]["n_sig_fwer"] or 0) > 0:
        flags.append("FWER 유의 번호쌍 존재")
    if pr["summary"]["genest"].get("p_mc", 1) < alpha:
        flags.append("쌍 전역(Genest) 유의")
    flags.extend(tmp["alerts"])
    if cd:
        flags.extend(cd["alerts"])
    return {"consistent_with_uniform_null": not flags, "flags": flags}


# --- run 간 차이 (PRD S8.4) ---
def previous_done_run(session: Session, run: AnalysisRun) -> AnalysisRun | None:
    return session.scalars(
        select(AnalysisRun)
        .where(
            AnalysisRun.cohort == run.cohort,
            AnalysisRun.status == "done",
            AnalysisRun.run_id != run.run_id,
            AnalysisRun.created_at < run.created_at,
        )
        .order_by(AnalysisRun.created_at.desc())
        .limit(1)
    ).first()


def diff_runs(session: Session, prev: AnalysisRun, cur: dict) -> dict:
    """직전 done run(같은 군) 대비: 전역 p·유의 번호/쌍 집합·최대 쌍·verdict 변동 요약."""
    ps = get_section(session, prev.run_id, "summary") or {}
    pf = get_section(session, prev.run_id, "frequency") or {}
    pp = get_section(session, prev.run_id, "pairs") or {}
    cs, cf, cp = cur["summary"], cur["frequency"], cur["pairs"]
    prev_nums = {r["number"] for r in pf.get("rows", []) if r.get("sig_bh")}
    cur_nums = {r["number"] for r in cf["rows"] if r.get("sig_bh")}
    prev_pairs = {(r["a"], r["b"]) for r in pp.get("rows", []) if r.get("sig_bh")}
    cur_pairs = {(r["a"], r["b"]) for r in cp["rows"] if r.get("sig_bh")}
    pk, ck = ps.get("kpi", {}), cs["kpi"]

    def _d(key: str) -> dict:
        a, b = pk.get(key), ck.get(key)
        return {
            "previous": a,
            "current": b,
            "delta": (b - a) if isinstance(a, int | float) and isinstance(b, int | float) else None,
        }

    prev_verdict = (ps.get("verdict") or {}).get("consistent_with_uniform_null")
    cur_verdict = cs["verdict"]["consistent_with_uniform_null"]
    parts = [
        f"J p {pk.get('global_p_joe', float('nan')):.3f}→{ck['global_p_joe']:.3f}",
        f"유의 번호 {len(prev_nums)}→{len(cur_nums)}",
        f"유의 쌍 {len(prev_pairs)}→{len(cur_pairs)}",
        f"최대 쌍 {pk.get('max_pair')}→{ck['max_pair']}",
    ]
    if prev_verdict is not None and prev_verdict != cur_verdict:
        parts.append("판정 변경: " + ("균등 일치→불일치" if prev_verdict else "불일치→균등 일치"))
    return {
        "previous_run_id": prev.run_id,
        "previous_draw_to": prev.draw_to,
        "current_draw_to": cs["draw_to"],
        "n_draws_delta": cs["T"] - prev.n_draws,
        "global_p_joe": _d("global_p_joe"),
        "order_stat_p": _d("order_stat_p"),
        "genest_p_mc": _d("genest_p_mc"),
        "max_pair_p_maxT": _d("max_pair_p_maxT"),
        "cross_draw_p_maxT": _d("cross_draw_p_maxT"),
        "sig_numbers": {
            "added": sorted(cur_nums - prev_nums),
            "removed": sorted(prev_nums - cur_nums),
            "n_prev": len(prev_nums),
            "n_cur": len(cur_nums),
        },
        "sig_pairs": {
            "added": [list(x) for x in sorted(cur_pairs - prev_pairs)],
            "removed": [list(x) for x in sorted(prev_pairs - cur_pairs)],
            "n_prev": len(prev_pairs),
            "n_cur": len(cur_pairs),
        },
        "verdict_changed": prev_verdict is not None and prev_verdict != cur_verdict,
        "summary": " · ".join(parts),
    }


def prune_runs(session: Session) -> list[str]:
    """LOTTO_RUN_RETENTION 초과 done run 정리 (0=무제한). 군별 최신 run·활성 실험 참조 run 은 보존."""
    keep_n = settings.lotto_run_retention
    if keep_n <= 0:
        return []
    from app.db.models import Experiment

    done = list(
        session.scalars(
            select(AnalysisRun).where(AnalysisRun.status == "done").order_by(AnalysisRun.created_at.desc())
        ).all()
    )
    if len(done) <= keep_n:
        return []
    protected: set[str] = set()
    for cohort in ("A", "B", "ALL"):
        for r in done:
            if r.cohort == cohort:
                protected.add(r.run_id)
                break
    protected.update(
        rid for rid in session.scalars(select(Experiment.parent_id).where(Experiment.is_active.is_(True))).all() if rid
    )
    removed: list[str] = []
    for r in done[keep_n:]:
        if r.run_id in protected:
            continue
        session.execute(delete(AnalysisResult).where(AnalysisResult.run_id == r.run_id))
        session.delete(r)
        removed.append(r.run_id)
    session.commit()
    return removed


# --- 조회 ---
def get_run(session: Session, run_id: str) -> AnalysisRun | None:
    return session.get(AnalysisRun, run_id)


def get_section(session: Session, run_id: str, section: str) -> dict | None:
    r = session.scalar(select(AnalysisResult).where(AnalysisResult.run_id == run_id, AnalysisResult.section == section))
    return None if r is None else r.payload


def list_runs(session: Session, limit: int = 50) -> list[AnalysisRun]:
    return list(session.scalars(select(AnalysisRun).order_by(AnalysisRun.created_at.desc()).limit(limit)).all())


def latest_done_run(session: Session, cohort: str | None = None) -> AnalysisRun | None:
    stmt = select(AnalysisRun).where(AnalysisRun.status == "done")
    if cohort:
        stmt = stmt.where(AnalysisRun.cohort == cohort)
    return session.scalars(stmt.order_by(AnalysisRun.created_at.desc()).limit(1)).first()


def run_to_dict(r: AnalysisRun) -> dict:
    return {
        "run_id": r.run_id,
        "cohort": r.cohort,
        "draw_from": r.draw_from,
        "draw_to": r.draw_to,
        "n_draws": r.n_draws,
        "preset": r.preset,
        "alpha": r.alpha,
        "correction": r.correction,
        "mc_iterations": r.mc_iterations,
        "seed": r.seed,
        "data_hash": r.data_hash,
        "versions": r.versions,
        "status": r.status,
        "progress": r.progress,
        "stage": r.stage,
        "error": r.error,
        "trigger": r.trigger,
        "created_at": to_iso(r.created_at),
        "finished_at": to_iso(r.finished_at),
        "diff_summary": _diff_summary(r),
    }


def _diff_summary(r: AnalysisRun) -> str | None:
    if r.status != "done":
        return None
    try:
        from app.db.base import SessionLocal as _SL

        with _SL() as s2:
            d = get_section(s2, r.run_id, "diff_vs_previous")
        return None if d is None else d.get("summary")
    except Exception:  # noqa: BLE001
        return None


# --- 자동 재실행 훅 (신규 회차 삽입 시) ---
def auto_rerun_hook(session: Session, inserted: list[int], trigger: str) -> str | None:
    preset = settings.lotto_auto_rerun_preset
    if preset == "off" or trigger == "seed":
        return None
    try:
        run = create_run(session, cohort="ALL", preset=preset, trigger="auto_import")
    except ValueError:
        return None
    start_run_background(run.run_id)
    return run.run_id
