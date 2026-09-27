"""S4.13 v1.24 — `.env.local` LOTTO_RANDOM_SEED 자동 갱신 (SEED 값 생성 완료 시)."""

from __future__ import annotations

from app.core import env_file


def test_replaces_existing_key_and_keeps_other_lines(tmp_path) -> None:  # noqa: ANN001
    p = tmp_path / ".env.local"
    p.write_text("A=1\nLOTTO_RANDOM_SEED=20260908\nB=2\n", encoding="utf-8")
    ok = env_file.update_env_local("LOTTO_RANDOM_SEED", "31321734", path=p)
    assert ok is True
    assert p.read_text(encoding="utf-8") == "A=1\nLOTTO_RANDOM_SEED=31321734\nB=2\n"


def test_appends_when_key_missing(tmp_path) -> None:  # noqa: ANN001
    p = tmp_path / ".env.local"
    p.write_text("A=1\n", encoding="utf-8")
    ok = env_file.update_env_local("LOTTO_RANDOM_SEED", "42", path=p)
    assert ok is True
    assert p.read_text(encoding="utf-8") == "A=1\nLOTTO_RANDOM_SEED=42\n"


def test_appends_with_newline_even_without_trailing_newline(tmp_path) -> None:  # noqa: ANN001
    p = tmp_path / ".env.local"
    p.write_text("A=1", encoding="utf-8")
    env_file.update_env_local("LOTTO_RANDOM_SEED", "7", path=p)
    assert p.read_text(encoding="utf-8") == "A=1\nLOTTO_RANDOM_SEED=7\n"


def test_missing_file_returns_false_and_creates_nothing(tmp_path) -> None:  # noqa: ANN001
    p = tmp_path / "does-not-exist" / ".env.local"
    assert env_file.update_env_local("LOTTO_RANDOM_SEED", "1", path=p) is False
    assert not p.exists()


def test_comments_and_unrelated_keys_preserved(tmp_path) -> None:  # noqa: ANN001
    p = tmp_path / ".env.local"
    content = "# comment\nLOTTO_POOL_SIZE=45\nLOTTO_RANDOM_SEED=1\n# another\nLOTTO_MAIN_COUNT=6\n"
    p.write_text(content, encoding="utf-8")
    env_file.update_env_local("LOTTO_RANDOM_SEED", "999", path=p)
    assert p.read_text(encoding="utf-8") == (
        "# comment\nLOTTO_POOL_SIZE=45\nLOTTO_RANDOM_SEED=999\n# another\nLOTTO_MAIN_COUNT=6\n"
    )
