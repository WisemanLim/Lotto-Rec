"""조건부 Monte-Carlo 영분포 — 한 번의 시뮬레이션 패스로 모든 통계량의 영분포를 수집 (PRD §4.6)."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from app.core.cross_draw import max_abs_cross_z_batch
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
    max_abs_z_cross: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))  # (B, L+1): lag 1..L, 창
    cross_max_lag: int = 0

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
            "cross_max_lag": self.cross_max_lag,
            "max_abs_z_cross_window": q(self.max_abs_z_cross[:, -1]) if self.max_abs_z_cross.size else {},
            "max_abs_z_cross_lag1": q(self.max_abs_z_cross[:, 0]) if self.max_abs_z_cross.size else {},
        }


_ACC_KEYS = ("x2", "mz1", "q", "mzp", "gx", "ov", "lag1", "cus", "cross")


def _save_checkpoint(
    path: Path, meta: dict, done: int, rng: np.random.Generator, acc: dict[str, list[np.ndarray]]
) -> None:
    """누적 배열·완료 반복수·RNG 상태를 원자적으로 저장 (tmp → os.replace). 저장 후 acc 는 배열 1개로 압축된다."""
    arrays: dict[str, Any] = {}  # Any: np.savez 의 **kwds 가 allow_pickle 키워드와 겹친다고 보는 mypy 회피
    for k, parts in acc.items():
        if parts:
            acc[k] = [np.concatenate(parts)]
            arrays[f"acc_{k}"] = acc[k][0]
    header = json.dumps({**meta, "done": done, "rng_state": rng.bit_generator.state})
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "wb") as f:
        np.savez(f, header=np.array(header), **arrays)
    os.replace(tmp, path)


def _load_checkpoint(path: Path, meta: dict) -> tuple[int, dict, dict[str, np.ndarray]] | None:
    """메타(T·B·seed·chunk·L)가 같을 때만 (done, rng_state, arrays) 반환 — 손상·불일치면 None(처음부터)."""
    try:
        with np.load(path, allow_pickle=False) as z:
            header = json.loads(str(z["header"]))
            if any(header.get(k) != v for k, v in meta.items()):
                return None
            arrays = {k[4:]: z[k] for k in z.files if k.startswith("acc_")}
    except (OSError, ValueError, KeyError):
        return None
    done = int(header["done"])
    if not 0 < done < meta["n_sims"] or any(len(a) != done for a in arrays.values()):
        return None
    return done, header["rng_state"], arrays


def run_null_simulation(
    T: int,
    n_sims: int,
    seed: int,
    game: Game = GAME,
    chunk: int = 64,
    progress: Callable[[float], None] | None = None,
    cross_max_lag: int = 0,
    checkpoint: Path | None = None,
    checkpoint_every: float = 30.0,
) -> NullDistributions:
    """`checkpoint` 를 주면 약 `checkpoint_every` 초마다 진행 상태를 저장하고, 시작 시 같은 메타의 체크포인트가
    있으면 RNG 상태를 복원해 남은 반복만 계산한다 — 결과는 중단 없이 실행한 것과 비트 단위로 같다 (S2.14)."""
    nd = NullDistributions(n_sims=n_sims, seed=seed, cross_max_lag=cross_max_lag)
    acc: dict[str, list[np.ndarray]] = {k: [] for k in _ACC_KEYS}
    p = game.p_single
    done = 0
    rng = np.random.default_rng(seed)
    meta = {"T": T, "n_sims": n_sims, "seed": seed, "chunk": chunk, "cross_max_lag": cross_max_lag}
    if checkpoint is not None:
        restored = _load_checkpoint(checkpoint, meta)
        if restored is not None:
            done, state, arrays = restored
            rng.bit_generator.state = state
            for k, a in arrays.items():
                acc[k].append(a)
            if progress:
                progress(done / n_sims)
    last_save = time.monotonic()
    for draws, x in iter_null_chunks(seed, n_sims - done, T, game, chunk, rng=rng):
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
        if cross_max_lag > 0:
            acc["cross"].append(max_abs_cross_z_batch(x, cross_max_lag, game))
        done += S
        if progress:
            progress(done / n_sims)
        if checkpoint is not None and done < n_sims and time.monotonic() - last_save >= checkpoint_every:
            _save_checkpoint(checkpoint, meta, done, rng, acc)
            last_save = time.monotonic()
    nd.x2_single = np.concatenate(acc["x2"])
    nd.max_abs_z_single = np.concatenate(acc["mz1"])
    nd.q_order = np.concatenate(acc["q"])
    nd.max_abs_z_pair = np.concatenate(acc["mzp"])
    nd.genest_x2 = np.concatenate(acc["gx"])
    nd.overlap_mean = np.concatenate(acc["ov"])
    nd.max_abs_lag1 = np.concatenate(acc["lag1"])
    nd.cusum_max = np.concatenate(acc["cus"])
    if cross_max_lag > 0:
        nd.max_abs_z_cross = np.concatenate(acc["cross"])
    return nd


__all__ = ["NullDistributions", "run_null_simulation", "pearson_x2"]
