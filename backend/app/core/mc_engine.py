"""조건부 Monte-Carlo 영분포 — 한 번의 시뮬레이션 패스로 모든 통계량의 영분포를 수집 (PRD §4.6)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from app.core.frequency import pearson_x2
from app.core.null_model import GAME, Game, iter_null_chunks
from app.core.order_stats import q_statistic_batch
from app.core.pairs import genest_x2_batch, max_abs_pair_z_batch
from app.core.temporal import cusum_max_batch, max_abs_lag1_batch, overlap_batch_mean


@dataclass
class NullDistributions:
    n_sims: int
    seed: int
    x2_single: np.ndarray = field(default_factory=lambda: np.zeros(0))
    max_abs_z_single: np.ndarray = field(default_factory=lambda: np.zeros(0))
    q_order: np.ndarray = field(default_factory=lambda: np.zeros(0))
    max_abs_z_pair: np.ndarray = field(default_factory=lambda: np.zeros(0))
    genest_x2: np.ndarray = field(default_factory=lambda: np.zeros(0))
    overlap_mean: np.ndarray = field(default_factory=lambda: np.zeros(0))
    max_abs_lag1: np.ndarray = field(default_factory=lambda: np.zeros(0))
    cusum_max: np.ndarray = field(default_factory=lambda: np.zeros(0))

    def summary(self) -> dict:
        def q(a: np.ndarray) -> dict:
            if not len(a):
                return {}
            return {
                "mean": float(a.mean()),
                "q50": float(np.quantile(a, 0.5)),
                "q95": float(np.quantile(a, 0.95)),
                "q99": float(np.quantile(a, 0.99)),
            }

        return {
            "n_sims": self.n_sims,
            "seed": self.seed,
            "x2_single": q(self.x2_single),
            "max_abs_z_single": q(self.max_abs_z_single),
            "q_order": q(self.q_order),
            "max_abs_z_pair": q(self.max_abs_z_pair),
            "genest_x2": q(self.genest_x2),
            "overlap_mean": q(self.overlap_mean),
            "max_abs_lag1": q(self.max_abs_lag1),
            "cusum_max": q(self.cusum_max),
        }


def run_null_simulation(
    T: int,
    n_sims: int,
    seed: int,
    game: Game = GAME,
    chunk: int = 64,
    progress: Callable[[float], None] | None = None,
) -> NullDistributions:
    nd = NullDistributions(n_sims=n_sims, seed=seed)
    acc: dict[str, list[np.ndarray]] = {k: [] for k in ("x2", "mz1", "q", "mzp", "gx", "ov", "lag1", "cus")}
    p = game.p_single
    done = 0
    for draws, x in iter_null_chunks(seed, n_sims, T, game, chunk):
        S = x.shape[0]
        counts = x.sum(axis=1).astype(np.float64)  # (S, N)
        e = T * p
        acc["x2"].append(np.sum((counts - e) ** 2 / e, axis=1))
        acc["mz1"].append(np.max(np.abs(counts - e), axis=1) / np.sqrt(T * p * (1 - p)))
        acc["q"].append(q_statistic_batch(draws.astype(np.float64), game))
        acc["mzp"].append(max_abs_pair_z_batch(x, game))
        acc["gx"].append(genest_x2_batch(x, game))
        acc["ov"].append(overlap_batch_mean(x))
        acc["lag1"].append(max_abs_lag1_batch(x))
        acc["cus"].append(cusum_max_batch(x, p))
        done += S
        if progress:
            progress(done / n_sims)
    nd.x2_single = np.concatenate(acc["x2"])
    nd.max_abs_z_single = np.concatenate(acc["mz1"])
    nd.q_order = np.concatenate(acc["q"])
    nd.max_abs_z_pair = np.concatenate(acc["mzp"])
    nd.genest_x2 = np.concatenate(acc["gx"])
    nd.overlap_mean = np.concatenate(acc["ov"])
    nd.max_abs_lag1 = np.concatenate(acc["lag1"])
    nd.cusum_max = np.concatenate(acc["cus"])
    return nd


__all__ = ["NullDistributions", "run_null_simulation", "pearson_x2"]
