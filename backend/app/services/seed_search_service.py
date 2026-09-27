"""SEED 값 생성 — 무작위 탐색 (PRD §E4 S4.13).

추천 생성 폼의 seed 를 채우기 위한 부가 기능: 대상 회차의 직전 실제 회차 결과를 기준으로,
매 시행마다 전략을 무작위로 골라 그 전략의 기본 가중치로 번호 6개를 무작위 생성 → 희망 등수와
같아질 때까지 반복 → 일치한 시행 횟수(1부터)를 seed 로 채택한다. 서버 백그라운드 스레드로 실행하며
DB 에 저장하지 않는(재시작 시 소멸) 인메모리 잡이다.

성능을 위해 실제 추천 생성(app.core.recommend.strategies.generate)의 커버리지 제약·전형성
재표본·당첨자수 모형 후보 랭킹은 적용하지 않고, 전략별 기본 가중치 벡터로 1회 비복원추출만 한다
(hybrid→bayesian_shrink, low_competition→uniform 대체 — winners_model 미보유 시 실제 로직의
기존 폴백과 동일). pair_association 만 기본 파라미터의 순차 Lift 가중을 그대로 적용한다.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.env_file import update_env_local
from app.core.recommend import strategies as strat
from app.core.recommend.strategies import (
    STRATEGIES,
    WEIGHT_FUNCS,
    _sequential_with_lift,
    weighted_sample_without_replacement,
)
from app.db.models import Draw
from app.services.draws import max_draw_no
from app.services.recommend_service import build_context
from app.services.tracking_service import rank_of

_JOB_TTL_SECONDS = 1800.0  # 완료/중지된 잡을 이 시간 이상 보관하지 않음 (메모리 정리)


@dataclass
class SeedSearchJob:
    job_id: str
    target_draw_no: int
    compare_draw_no: int
    target_rank: int
    max_iterations: int
    status: str = "running"  # running | done | stopped | error
    iterations: int = 0
    seed: int | None = None
    matched_strategy: str | None = None
    matched_ticket: list[int] | None = None
    stop_reason: str | None = None  # "user" | "max_iterations" (status=stopped 일 때만)
    env_updated: bool = False  # status=done 일 때 .env.local LOTTO_RANDOM_SEED 갱신 성공 여부 (v1.24)
    error: str | None = None
    started_at: float = field(default_factory=time.monotonic)
    finished_at: float | None = None
    stop_event: threading.Event = field(default_factory=threading.Event, repr=False, compare=False)

    def elapsed_seconds(self) -> float:
        end = self.finished_at if self.finished_at is not None else time.monotonic()
        return round(end - self.started_at, 3)

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "target_draw_no": self.target_draw_no,
            "compare_draw_no": self.compare_draw_no,
            "target_rank": self.target_rank,
            "iterations": self.iterations,
            "seed": self.seed,
            "matched_strategy": self.matched_strategy,
            "matched_ticket": self.matched_ticket,
            "stop_reason": self.stop_reason,
            "env_updated": self.env_updated,
            "max_iterations": self.max_iterations,
            "elapsed_seconds": self.elapsed_seconds(),
            "error": self.error,
        }


_lock = threading.Lock()
_jobs: dict[str, SeedSearchJob] = {}


def _prune_locked(now: float) -> None:
    stale = [
        jid
        for jid, j in _jobs.items()
        if j.status != "running" and j.finished_at is not None and now - j.finished_at > _JOB_TTL_SECONDS
    ]
    for jid in stale:
        del _jobs[jid]


def get_job(job_id: str) -> SeedSearchJob | None:
    with _lock:
        return _jobs.get(job_id)


def stop_job(job_id: str) -> SeedSearchJob | None:
    job = get_job(job_id)
    if job is not None:
        job.stop_event.set()
    return job


def _build_pickers(ctx: strat.Context) -> tuple[list[str], dict[str, np.ndarray], np.ndarray | None]:
    """전략별 기본 가중치 벡터(단순화 — 위 모듈 docstring 참고) + pair_association 용 lift 행렬."""
    names = list(STRATEGIES.keys())
    weights: dict[str, np.ndarray] = {}
    for name in names:
        w_fn = WEIGHT_FUNCS.get(name, WEIGHT_FUNCS["uniform"])
        weights[name] = w_fn(ctx, strat.default_params(name))
    lift = ctx.lift_matrix() if "pair_association" in names else None
    return names, weights, lift


def _draw_ticket(
    rng: np.random.Generator, name: str, ctx: strat.Context, weights: dict[str, np.ndarray], lift: np.ndarray | None
) -> np.ndarray:
    if name == "pair_association" and lift is not None:
        p = strat.default_params(name)
        power = float(p.get("lift_power", 1.0))
        floor = float(p.get("floor", 0.05))
        return _sequential_with_lift(rng, ctx, weights[name], lift, power, floor)
    return weighted_sample_without_replacement(rng, weights[name], ctx.game.k)


def _run(job: SeedSearchJob, ctx: strat.Context, compare_main: set[int], compare_bonus: int) -> None:
    try:
        names, weights, lift = _build_pickers(ctx)
        rng = np.random.default_rng()  # OS 엔트로피 — 탐색 자체는 재현성 불필요(결과 seed 가 재현 대상)
        n = len(names)
        iterations = 0
        report_every = 2000
        while not job.stop_event.is_set() and iterations < job.max_iterations:
            iterations += 1
            name = names[int(rng.integers(n))]
            ticket = _draw_ticket(rng, name, ctx, weights, lift)
            m = len(compare_main.intersection(ticket.tolist()))
            b = compare_bonus in ticket
            if rank_of(m, b) == job.target_rank:
                try:
                    env_updated = update_env_local("LOTTO_RANDOM_SEED", str(iterations))
                except OSError:
                    env_updated = False
                with _lock:
                    job.iterations = iterations
                    job.seed = iterations
                    job.matched_strategy = name
                    job.matched_ticket = sorted(int(x) for x in ticket)
                    job.env_updated = env_updated
                    job.status = "done"
                    job.finished_at = time.monotonic()
                return
            if iterations % report_every == 0:
                with _lock:
                    job.iterations = iterations
        with _lock:
            job.iterations = iterations
            job.status = "stopped"
            job.stop_reason = "user" if job.stop_event.is_set() else "max_iterations"
            job.finished_at = time.monotonic()
    except Exception as e:  # noqa: BLE001 — 백그라운드 스레드 최상위: 실패를 잡 상태로 남긴다
        with _lock:
            job.status = "error"
            job.error = str(e)
            job.finished_at = time.monotonic()


def start_seed_search(session: Session, *, target_draw_no: int | None, target_rank: int) -> dict:
    latest = max_draw_no(session) or 0
    target = target_draw_no or latest + 1
    compare_draw_no = target - 1
    if compare_draw_no < 1:
        raise ValueError(f"{target}회는 직전 회차가 없어 SEED 탐색을 시작할 수 없습니다")
    draw = session.get(Draw, compare_draw_no)
    if draw is None:
        raise ValueError(f"{compare_draw_no}회(직전 회차) 결과가 없어 SEED 탐색을 시작할 수 없습니다")
    compare_main = set(draw.numbers)
    compare_bonus = int(draw.bonus)
    ctx = build_context(session, draw_to=compare_draw_no, use_winners_model=False)

    job = SeedSearchJob(
        job_id=str(uuid.uuid4()),
        target_draw_no=target,
        compare_draw_no=compare_draw_no,
        target_rank=target_rank,
        max_iterations=settings.lotto_seed_search_max_iter,
    )
    with _lock:
        _prune_locked(time.monotonic())
        _jobs[job.job_id] = job
    th = threading.Thread(
        target=_run, args=(job, ctx, compare_main, compare_bonus), daemon=True, name=f"seed-{job.job_id[:8]}"
    )
    th.start()
    return job.to_dict()
