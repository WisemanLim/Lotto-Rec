"""설정 파일 우선순위 — .env.local(사용자 값) 이 .env.local.example(기본값) 을 덮어써야 한다 (2026-09-14 보고)."""

from pathlib import Path

from app.core.config import Settings


def test_env_local_overrides_example(tmp_path: Path, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.delenv("LOTTO_NUMBER_RECOMMENDATION_COUNT", raising=False)
    example = tmp_path / ".env.local.example"
    local = tmp_path / ".env.local"
    example.write_text("LOTTO_NUMBER_RECOMMENDATION_COUNT=10\nLOTTO_TIMEZONE=UTC\n", encoding="utf-8")
    local.write_text("LOTTO_NUMBER_RECOMMENDATION_COUNT=20\n", encoding="utf-8")
    s = Settings(_env_file=(example, tmp_path / ".env", local))
    assert s.lotto_number_recommendation_count == 20  # 사용자 값 우선
    assert s.lotto_timezone == "UTC"  # 없는 키는 example 기본값으로 채움

    # OS 환경변수는 파일보다 우선
    monkeypatch.setenv("LOTTO_NUMBER_RECOMMENDATION_COUNT", "30")
    assert Settings(_env_file=(example, local)).lotto_number_recommendation_count == 30


def test_default_env_file_order_puts_local_last() -> None:
    files = [Path(p).name for p in Settings.model_config["env_file"]]  # type: ignore[union-attr]
    assert files == [".env.local.example", ".env", ".env.local"]
