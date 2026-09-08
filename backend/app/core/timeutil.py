"""시각 직렬화 — 저장은 UTC, 반환은 오프셋 포함 ISO 8601 (PRD §10 LOTTO_TIMEZONE).

SQLite 는 tz 정보를 버리므로 naive datetime 은 UTC 로 간주해 '+00:00' 을 붙인다. 표시 시간대 변환은 프론트(Intl) 담당.
"""

from __future__ import annotations

from datetime import UTC, datetime


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat()
