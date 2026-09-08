"""PRD §12.1 이론값 — 엔진 구현 전 기준값 고정 (구현 후 app.core.null_model 함수로 대체)."""

from math import comb

N, K = 45, 6


def test_pair_probability_is_one_over_66() -> None:
    p = K * (K - 1) / (N * (N - 1))
    assert abs(p - 1 / 66) < 1e-12


def test_naive_lift_under_null() -> None:
    lift_h0 = N * (K - 1) / (K * (N - 1))
    assert abs(lift_h0 - 225 / 264) < 1e-12  # ≈ 0.8523 (Perplexity 문서의 0.886 은 오류)


def test_consecutive_overlap_expectation() -> None:
    assert abs(K * K / N - 0.8) < 1e-12


def test_match_distribution_sums_to_one() -> None:
    tot = comb(N, K)
    p = [comb(K, i) * comb(N - K, K - i) / tot for i in range(K + 1)]
    assert abs(sum(p) - 1) < 1e-12
    assert abs(sum(i * x for i, x in enumerate(p)) - 0.8) < 1e-12


def test_order_statistic_means() -> None:
    mu = [(N + 1) * i / (K + 1) for i in range(1, K + 1)]
    assert [round(m, 2) for m in mu] == [6.57, 13.14, 19.71, 26.29, 32.86, 39.43]


def test_joe_adjustment_coefficient() -> None:
    assert abs((N - 1) / (N - K) - 44 / 39) < 1e-12
