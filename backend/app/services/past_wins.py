"""과거 1·2등 일치 조회 (PRD S4.9).

티켓 6개 번호가 적재된 과거 회차의 1등(본번호 6개 동일) 또는 2등(본번호 5개 + 해당 회차 보너스)
조합과 같으면 해당 회차를 돌려준다. 통계적 의미는 없음(§4.11) — 표시 전용.
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.services.draws import load_draws

Key = frozenset[int]


class PastWinIndex:
    """frozenset(6개 번호) → [(draw_no, rank)]. 회차당 1등 키 1개 + 2등 키 6개."""

    def __init__(self, session: Session) -> None:
        ds = load_draws(session)
        self._idx: dict[Key, list[dict[str, int]]] = {}
        for draw_no, main, bonus in zip(ds.draw_no.tolist(), ds.main.tolist(), ds.bonus.tolist(), strict=True):
            self._add(frozenset(main), int(draw_no), 1)
            for i in range(6):
                self._add(frozenset(main[:i] + main[i + 1 :] + [bonus]), int(draw_no), 2)

    def _add(self, key: Key, draw_no: int, rank: int) -> None:
        self._idx.setdefault(key, []).append({"draw_no": draw_no, "rank": rank})

    def lookup(self, ticket: Iterable[int]) -> list[dict[str, int]]:
        hits = self._idx.get(frozenset(int(n) for n in ticket), [])
        return sorted(hits, key=lambda h: (h["draw_no"], h["rank"]))
